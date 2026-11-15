import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { mercatorProject, mercatorUnproject } from '../crs/Mercator'
import { WGS84_A, MERCATOR_MAX_LAT } from '../crs/constants'

const HALF_WORLD = Math.PI * WGS84_A

describe('Web Mercator (EPSG:3857)', () => {
  it('projects the equator/prime-meridian intersection to the origin', () => {
    const m = mercatorProject({ lng: 0, lat: 0 })
    expect(m.x).toBeCloseTo(0, 6)
    expect(m.y).toBeCloseTo(0, 6)
  })

  it('projects longitude linearly in metres', () => {
    const east = mercatorProject({ lng: 180, lat: 0 })
    expect(east.x).toBeCloseTo(HALF_WORLD, 4)
    const west = mercatorProject({ lng: -180, lat: 0 })
    expect(west.x).toBeCloseTo(-HALF_WORLD, 4)
  })

  it('clamps latitudes beyond the Mercator limit', () => {
    const clamped = mercatorProject({ lng: 0, lat: 89 })
    const limit = mercatorProject({ lng: 0, lat: MERCATOR_MAX_LAT })
    expect(clamped.y).toBeCloseTo(limit.y, 6)
  })

  it('round-trips project/unproject', () => {
    const original = { lng: 116.404, lat: 39.915, alt: 50 }
    const m = mercatorProject(original)
    const back = mercatorUnproject(m)
    expect(back.lng).toBeCloseTo(original.lng, 8)
    expect(back.lat).toBeCloseTo(original.lat, 8)
    expect(back.alt).toBe(50)
  })

  it('can write into an existing vector', () => {
    const target = new THREE.Vector3()
    const result = mercatorProject({ lng: 10, lat: 10 }, target)
    expect(result).toBe(target)
  })
})
