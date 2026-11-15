import * as THREE from 'three'
import { DEFAULT_AXES, DEFAULT_ORIGIN } from './constants'
import { createLocalPlane } from './LocalPlane'
import { fromWGS84, toWGS84 } from './Datum'
import type {
  AxesMapping,
  CRS,
  CrsCode,
  DatumType,
  GeoPoint,
  GeoReferenceOptions,
  LocalPlane
} from './types'

interface AxisSpec {
  axis: 0 | 1 | 2
  sign: 1 | -1
}

function parseAxis(spec: string): AxisSpec {
  const negative = spec.trim().startsWith('-')
  const name = spec.trim().replace(/^[+-]/, '')
  if (name !== 'x' && name !== 'y' && name !== 'z') {
    throw new Error(
      `GeoReference: invalid axis "${spec}", expected one of x/y/z with optional sign`
    )
  }
  return { axis: (name.charCodeAt(0) - 120) as 0 | 1 | 2, sign: negative ? -1 : 1 }
}

function validateAxes(axes: AxesMapping): void {
  const used = [axes.east, axes.north, axes.up].map((a) => a.replace(/^[+-]/, ''))
  if (new Set(used).size !== 3) {
    throw new Error('GeoReference: axes mapping must map east/north/up to three distinct axes')
  }
}

/**
 * Binds a CRS, datum and axis convention to a fixed local origin and converts
 * geographic coordinates to/from the small metre-space coordinates placed in
 * the three.js scene. Keeping a local origin is what prevents float32 jitter at
 * city scale (absolute Web Mercator values are ~1.3e7 metres).
 */
export class GeoReference {
  readonly origin: GeoPoint
  readonly crsCode: CrsCode
  readonly datum: DatumType
  readonly axes: AxesMapping

  private readonly plane: LocalPlane
  private readonly east: AxisSpec
  private readonly north: AxisSpec
  private readonly up: AxisSpec
  private readonly basisMatrix: THREE.Matrix4
  private readonly enuScratch: THREE.Vector3

  constructor(origin: GeoPoint = DEFAULT_ORIGIN, options: GeoReferenceOptions = {}) {
    const crsOption = options.crs ?? 'EPSG:4326'
    this.crsCode = typeof crsOption === 'string' ? crsOption : (crsOption as CRS).code
    this.datum = options.datum ?? 'WGS84'
    this.axes = options.axes ?? DEFAULT_AXES
    validateAxes(this.axes)

    this.origin = { lng: origin.lng, lat: origin.lat, alt: origin.alt ?? 0 }
    this.plane = createLocalPlane(this.crsCode, this.origin)

    this.east = parseAxis(this.axes.east)
    this.north = parseAxis(this.axes.north)
    this.up = parseAxis(this.axes.up)

    this.basisMatrix = new THREE.Matrix4().makeBasis(
      this.axisVector(this.east),
      this.axisVector(this.north),
      this.axisVector(this.up)
    )
    this.enuScratch = new THREE.Vector3()
  }

  private axisVector(spec: AxisSpec): THREE.Vector3 {
    const v = new THREE.Vector3()
    v.setComponent(spec.axis, spec.sign)
    return v
  }

  /** Convert a geographic point to local three.js metres relative to the origin. */
  toLocal(p: GeoPoint, datum: DatumType = this.datum, target?: THREE.Vector3): THREE.Vector3 {
    const wgs = datum === 'WGS84' ? p : toWGS84(p, datum)
    const enu = this.plane.toENU(wgs, this.enuScratch)

    const out = target ?? new THREE.Vector3()
    out.set(0, 0, 0)
    out.addScaledVector(this.axisVector(this.east), enu.x)
    out.addScaledVector(this.axisVector(this.north), enu.y)
    out.addScaledVector(this.axisVector(this.up), enu.z)
    return out
  }

  /** Convert local three.js metres back to a geographic point. */
  toGeo(v: THREE.Vector3, datum: DatumType = this.datum, target?: GeoPoint): GeoPoint {
    const e = this.east.sign * v.getComponent(this.east.axis)
    const n = this.north.sign * v.getComponent(this.north.axis)
    const u = this.up.sign * v.getComponent(this.up.axis)
    const enu = this.enuScratch.set(e, n, u)
    const wgs = this.plane.fromENU(enu)

    if (target) {
      Object.assign(target, datum === 'WGS84' ? wgs : fromWGS84(wgs, datum))
      return target
    }
    return datum === 'WGS84' ? wgs : fromWGS84(wgs, datum)
  }

  /**
   * Pure ENU -> three.js basis transform (no translation, the origin maps to
   * (0,0,0)). Attach it to a Group whose children are authored in ENU space.
   */
  get matrix(): THREE.Matrix4 {
    return this.basisMatrix
  }

  /** Place an existing object at a geographic position. */
  setPosition(object: THREE.Object3D, p: GeoPoint, datum: DatumType = this.datum): THREE.Object3D {
    this.toLocal(p, datum, object.position)
    return object
  }

  /** Great-circle-free planar distance between two geographic points, in metres. */
  distance(a: GeoPoint, b: GeoPoint, datum: DatumType = this.datum): number {
    const va = this.toLocal(a, datum)
    const vb = this.toLocal(b, datum)
    return va.distanceTo(vb)
  }
}

/** Convenience factory mirroring the functional style of the other utilities. */
export function createGeoReference(origin?: GeoPoint, options?: GeoReferenceOptions): GeoReference {
  return new GeoReference(origin, options)
}
