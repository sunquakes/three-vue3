import * as THREE from 'three'
import { WGS84_A, DEG2RAD, MERCATOR_MAX_LAT } from './constants'
import { mercatorProject, mercatorUnproject } from './Mercator'
import type { CrsCode, GeoPoint, LocalPlane } from './types'

function clampLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat))
}

/**
 * Local equirectangular (plate carree) tangent plane for EPSG:4326.
 * East/north offsets are true metres using the cosine of the origin latitude,
 * which is accurate to within a few centimetres for city-scale (<20 km) data.
 */
class EquirectPlane implements LocalPlane {
  readonly origin: GeoPoint
  private readonly originLatRad: number
  private readonly metersPerDegLat: number
  private readonly metersPerDegLng: number

  constructor(origin: GeoPoint) {
    this.origin = { lng: origin.lng, lat: clampLat(origin.lat), alt: origin.alt ?? 0 }
    this.originLatRad = this.origin.lat * DEG2RAD
    this.metersPerDegLat = (Math.PI * WGS84_A) / 180
    this.metersPerDegLng = this.metersPerDegLat * Math.cos(this.originLatRad)
  }

  toENU(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3 {
    const east = (p.lng - this.origin.lng) * this.metersPerDegLng
    const north = (p.lat - this.origin.lat) * this.metersPerDegLat
    const up = (p.alt ?? 0) - (this.origin.alt ?? 0)
    return (target ?? new THREE.Vector3()).set(east, north, up)
  }

  fromENU(enu: THREE.Vector3, target?: GeoPoint): GeoPoint {
    const lng = this.origin.lng + enu.x / this.metersPerDegLng
    const lat = this.origin.lat + enu.y / this.metersPerDegLat
    const alt = (this.origin.alt ?? 0) + enu.z
    return target ? Object.assign(target, { lng, lat, alt }) : { lng, lat, alt }
  }
}

/**
 * Local Web Mercator plane for EPSG:3857. Points are projected to Mercator
 * metres and the origin's Mercator position is subtracted. The plane preserves
 * Mercator shapes exactly (ideal for overlaying XYZ raster tiles later) but its
 * vertical scale is stretched by 1/cos(lat) away from the equator.
 */
class MercatorPlane implements LocalPlane {
  readonly origin: GeoPoint
  private readonly originMeters: THREE.Vector3

  constructor(origin: GeoPoint) {
    this.origin = { lng: origin.lng, lat: clampLat(origin.lat), alt: origin.alt ?? 0 }
    this.originMeters = mercatorProject(this.origin)
  }

  toENU(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3 {
    const m = mercatorProject(p, target)
    m.sub(this.originMeters)
    return m
  }

  fromENU(enu: THREE.Vector3, target?: GeoPoint): GeoPoint {
    const abs = enu.clone().add(this.originMeters)
    return mercatorUnproject(abs, target)
  }
}

/** Create the local tangent plane for a CRS code at the given origin. */
export function createLocalPlane(crs: CrsCode, origin: GeoPoint): LocalPlane {
  return crs === 'EPSG:3857' ? new MercatorPlane(origin) : new EquirectPlane(origin)
}
