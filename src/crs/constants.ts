import type { AxesMapping, GeoPoint } from './types'

/** WGS84 ellipsoid semi-major axis in metres. */
export const WGS84_A = 6378137.0

/** WGS84 ellipsoid flattening derived eccentricity squared (first eccentricity). */
export const WGS84_E2 = 0.0066943799901413165

/** Pi / 180 degree to radian factor. */
export const DEG2RAD = Math.PI / 180

/** 180 / Pi radian to degree factor. */
export const RAD2DEG = 180 / Math.PI

/** Maximum latitude representable by Web Mercator (~85.05112878 degrees). */
export const MERCATOR_MAX_LAT = 85.05112877980659

/** GCJ02 encryption parameters (Krasovsky 1940 ellipsoid). */
export const GCJ_A = 6378245.0
export const GCJ_EE = 0.006693421622965943

/** Default local origin used when none is supplied (longitude/latitude 0). */
export const DEFAULT_ORIGIN: GeoPoint = { lng: 0, lat: 0, alt: 0 }

/**
 * Default axis mapping: East -> +X, North -> -Z, Up -> +Y.
 * With the default camera on +Z looking toward -Z, north points up on screen.
 */
export const DEFAULT_AXES: AxesMapping = {
  east: 'x',
  north: '-z',
  up: 'y'
}

/** Bounding box used to decide whether GCJ02 encryption applies (mainland China). */
export const CHINA_BOUNDS = {
  lngMin: 72.004,
  lngMax: 137.8347,
  latMin: 0.8293,
  latMax: 55.8271
}
