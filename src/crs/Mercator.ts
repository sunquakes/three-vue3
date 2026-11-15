import * as THREE from 'three'
import { WGS84_A, DEG2RAD, RAD2DEG, MERCATOR_MAX_LAT } from './constants'
import type { CRS, CrsCode, GeoPoint } from './types'

function clampLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat))
}

/** Spherical (Web) Mercator projection, EPSG:3857. Output is metres in float64. */
class MercatorCRS implements CRS {
  readonly code: CrsCode = 'EPSG:3857'

  project(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3 {
    const lat = clampLat(p.lat)
    const x = WGS84_A * p.lng * DEG2RAD
    const y = WGS84_A * Math.log(Math.tan(Math.PI / 4 + (lat * DEG2RAD) / 2))
    const z = p.alt ?? 0
    return (target ?? new THREE.Vector3()).set(x, y, z)
  }

  unproject(v: THREE.Vector3, target?: GeoPoint): GeoPoint {
    const lng = (v.x / WGS84_A) * RAD2DEG
    const lat = (2 * Math.atan(Math.exp(v.y / WGS84_A)) - Math.PI / 2) * RAD2DEG
    return target ? Object.assign(target, { lng, lat, alt: v.z }) : { lng, lat, alt: v.z }
  }
}

export const mercatorCRS: CRS = new MercatorCRS()

/** Project a geographic point to EPSG:3857 metres (x = easting, y = northing, z = height). */
export function mercatorProject(p: GeoPoint, target?: THREE.Vector3): THREE.Vector3 {
  return mercatorCRS.project(p, target)
}

/** Inverse of mercatorProject. */
export function mercatorUnproject(v: THREE.Vector3, target?: GeoPoint): GeoPoint {
  return mercatorCRS.unproject(v, target)
}
