import { DEG2RAD, GCJ_A, GCJ_EE, CHINA_BOUNDS } from './constants'
import type { DatumType, GeoPoint } from './types'

const X_PI = (Math.PI * 3000.0) / 180.0

function isInChina(lng: number, lat: number): boolean {
  return (
    lng >= CHINA_BOUNDS.lngMin &&
    lng <= CHINA_BOUNDS.lngMax &&
    lat >= CHINA_BOUNDS.latMin &&
    lat <= CHINA_BOUNDS.latMax
  )
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0
  ret +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0
  ret +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0
  return ret
}

/** WGS84 -> GCJ02 ("Mars"). Coordinates outside mainland China are returned unchanged. */
export function wgs84ToGcj02(p: GeoPoint): GeoPoint {
  const { lng, lat, alt } = p
  if (!isInChina(lng, lat)) return { lng, lat, alt }

  // Standard GCJ02 deltas are polynomials over the offset from the GCJ
  // reference meridian/parallel (105E / 35N).
  const dX = lng - 105.0
  const dY = lat - 35.0
  let dLat = transformLat(dX, dY)
  let dLng = transformLng(dX, dY)
  const radLat = lat * DEG2RAD
  let magic = Math.sin(radLat)
  magic = 1.0 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  // Polynomial deltas are in metres; convert to radians (then to degrees).
  dLat = dLat / (((GCJ_A * (1.0 - GCJ_EE)) / (magic * sqrtMagic)) * DEG2RAD)
  dLng = dLng / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * DEG2RAD)
  return { lng: lng + dLng, lat: lat + dLat, alt }
}

/** GCJ02 -> WGS84 via fixed-point iteration (sub-metre accuracy after a few steps). */
export function gcj02ToWgs84(p: GeoPoint): GeoPoint {
  const { lng, lat, alt } = p
  if (!isInChina(lng, lat)) return { lng, lat, alt }

  let wLng = lng
  let wLat = lat
  for (let i = 0; i < 6; i++) {
    const shifted = wgs84ToGcj02({ lng: wLng, lat: wLat })
    wLng += lng - shifted.lng
    wLat += lat - shifted.lat
  }
  return { lng: wLng, lat: wLat, alt }
}

/** GCJ02 -> BD09 (Baidu). */
export function gcj02ToBd09(p: GeoPoint): GeoPoint {
  const { lng, lat, alt } = p
  const x = lng
  const y = lat
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI)
  return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006, alt }
}

/** BD09 (Baidu) -> GCJ02. */
export function bd09ToGcj02(p: GeoPoint): GeoPoint {
  const { lng, lat, alt } = p
  const x = lng - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI)
  return { lng: z * Math.cos(theta), lat: z * Math.sin(theta), alt }
}

/** Normalize any supported datum to WGS84. */
export function toWGS84(p: GeoPoint, datum: DatumType): GeoPoint {
  if (datum === 'WGS84') return p
  if (datum === 'GCJ02') return gcj02ToWgs84(p)
  return gcj02ToWgs84(bd09ToGcj02(p))
}

/** Express a WGS84 point in the requested datum. */
export function fromWGS84(p: GeoPoint, datum: DatumType): GeoPoint {
  if (datum === 'WGS84') return p
  if (datum === 'GCJ02') return wgs84ToGcj02(p)
  return gcj02ToBd09(wgs84ToGcj02(p))
}

/** Convert a point between any two supported datums. */
export function convertDatum(p: GeoPoint, from: DatumType, to: DatumType): GeoPoint {
  if (from === to) return p
  return fromWGS84(toWGS84(p, from), to)
}
