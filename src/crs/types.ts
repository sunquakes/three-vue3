import * as THREE from 'three'

/**
 * A geographic position expressed in degrees.
 * - lng: longitude in the range [-180, 180]
 * - lat: latitude in the range [-90, 90]
 * - alt: ellipsoidal/orthometric height in metres above the reference surface
 *   (treated as a simple height above ground in the planar MVP)
 */
export interface GeoPoint {
  lng: number
  lat: number
  alt?: number
}

/**
 * Geodetic datum / coordinate encryption used by the input or output data.
 * - WGS84: raw GPS / international services
 * - GCJ02: AMap (Gaode), Tencent and most Chinese services ("Mars coordinates")
 * - BD09: Baidu Maps
 */
export type DatumType = 'WGS84' | 'GCJ02' | 'BD09'

/**
 * Built-in coordinate reference systems supported by the planar MVP.
 * - EPSG:4326: longitude/latitude degrees, local equirectangular ENU plane
 * - EPSG:3857: Spherical/Web Mercator metres
 */
export type CrsCode = 'EPSG:4326' | 'EPSG:3857'

/**
 * Mapping from the local east/north/up basis onto the three.js axes.
 * Each value is a signed single axis ('x' | 'y' | 'z' | '-x' | '-y' | '-z').
 * The default maps East -> +X, North -> -Z and Up -> +Y so a camera on +Z
 * looks at a scene where north points "up" on screen.
 */
export interface AxesMapping {
  east: string
  north: string
  up: string
}

/**
 * A coordinate reference system projects geographic points to/from a global
 * Cartesian frame measured in metres (using float64 precision internally).
 * The projected position is NOT what is placed in the scene directly; a
 * GeoReference recenters it around a local origin before handing it to three.js
 * (whose float32 positions would otherwise jitter at city scale).
 */
export interface CRS {
  readonly code: CrsCode
  /** Project a geographic point (degrees) to a global Cartesian point in metres. */
  project(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3
  /** Inverse of project: global Cartesian metres back to geographic degrees. */
  unproject(v: THREE.Vector3, target?: GeoPoint): GeoPoint
}

/**
 * A tangent-plane projection tied to a fixed local origin. All returned
 * positions are relative to that origin and measured in metres, so the values
 * fed to three.js stay small regardless of the city's absolute coordinates.
 */
export interface LocalPlane {
  readonly origin: GeoPoint
  /** Geographic point -> east/north/up offsets (metres) from the origin. */
  toENU(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3
  /** east/north/up offsets (metres) back to a geographic point. */
  fromENU(enu: THREE.Vector3, target?: GeoPoint): GeoPoint
}

/** Options accepted by the GeoReference constructor. */
export interface GeoReferenceOptions {
  /** CRS / planar model used for the tangent plane. Defaults to EPSG:4326. */
  crs?: CrsCode | CRS
  /** Datum of the coordinates passed to and returned from this reference. */
  datum?: DatumType
  /** Axis mapping between ENU and three.js. Defaults to E:+X, N:-Z, U:+Y. */
  axes?: AxesMapping
}
