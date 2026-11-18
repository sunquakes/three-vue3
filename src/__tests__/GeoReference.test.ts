import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { GeoReference } from '../crs/GeoReference'
import { wgs84ToGcj02 } from '../crs/Datum'

const BEIJING = { lng: 116.397, lat: 39.908 }
const METERS_PER_DEG_LAT = 111320

describe('GeoReference (EPSG:4326 equirectangular plane)', () => {
  const geo = new GeoReference(BEIJING)

  it('maps the origin to the scene origin', () => {
    const p = geo.toLocal(BEIJING)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })

  it('maps a northward offset onto -Z with the default axis mapping', () => {
    const north = geo.toLocal({ lng: BEIJING.lng, lat: BEIJING.lat + 0.001 })
    expect(north.x).toBeCloseTo(0, 6)
    expect(north.z).toBeCloseTo(-METERS_PER_DEG_LAT * 0.001, 1)
    expect(north.y).toBeCloseTo(0, 6)
  })

  it('maps an eastward offset onto +X scaled by cos(latitude)', () => {
    const east = geo.toLocal({ lng: BEIJING.lng + 0.001, lat: BEIJING.lat })
    const expected = METERS_PER_DEG_LAT * Math.cos((BEIJING.lat * Math.PI) / 180) * 0.001
    expect(east.x).toBeCloseTo(expected, 1)
    expect(east.z).toBeCloseTo(0, 6)
  })

  it('maps height onto +Y', () => {
    const up = geo.toLocal({ ...BEIJING, alt: 100 })
    expect(up.y).toBeCloseTo(100, 6)
  })

  it('round-trips toLocal/toGeo', () => {
    const target = { lng: BEIJING.lng + 0.01, lat: BEIJING.lat - 0.02, alt: 30 }
    const local = geo.toLocal(target)
    const back = geo.toGeo(local)
    expect(back.lng).toBeCloseTo(target.lng, 9)
    expect(back.lat).toBeCloseTo(target.lat, 9)
    expect(back.alt).toBeCloseTo(30, 6)
  })

  it('keeps scene coordinates small even though absolute Mercator values are huge', () => {
    const local = geo.toLocal({ lng: BEIJING.lng + 0.0001, lat: BEIJING.lat + 0.0001 })
    expect(Math.abs(local.x)).toBeLessThan(20)
    expect(Math.abs(local.z)).toBeLessThan(20)
  })
})

describe('GeoReference datum handling', () => {
  it('converts GCJ02 input to the same local point as its WGS84 equivalent', () => {
    const geo = new GeoReference(BEIJING, { datum: 'WGS84' })
    const gcjPoint = wgs84ToGcj02({ lng: BEIJING.lng + 0.01, lat: BEIJING.lat + 0.01 })
    const wgsPoint = { lng: BEIJING.lng + 0.01, lat: BEIJING.lat + 0.01 }

    const fromGcj = geo.toLocal(gcjPoint, 'GCJ02')
    const fromWgs = geo.toLocal(wgsPoint, 'WGS84')
    expect(fromGcj.x).toBeCloseTo(fromWgs.x, 4)
    expect(fromGcj.z).toBeCloseTo(fromWgs.z, 4)
  })

  it('returns coordinates in the configured datum from toGeo', () => {
    const geo = new GeoReference(BEIJING, { datum: 'GCJ02' })
    const wgsPoint = { lng: BEIJING.lng + 0.01, lat: BEIJING.lat + 0.01 }
    const local = geo.toLocal(wgsPoint, 'WGS84')
    const back = geo.toGeo(local)
    const expected = wgs84ToGcj02(wgsPoint)
    expect(back.lng).toBeCloseTo(expected.lng, 6)
    expect(back.lat).toBeCloseTo(expected.lat, 6)
  })
})

describe('GeoReference (EPSG:3857 Mercator plane)', () => {
  it('recenters Mercator metres around the origin and round-trips', () => {
    const geo = new GeoReference(BEIJING, { crs: 'EPSG:3857' })
    const local = geo.toLocal({ lng: BEIJING.lng + 0.005, lat: BEIJING.lat + 0.005 })
    expect(Math.abs(local.x)).toBeLessThan(1000)
    expect(Math.abs(local.z)).toBeLessThan(1000)

    const back = geo.toGeo(local)
    expect(back.lng).toBeCloseTo(BEIJING.lng + 0.005, 8)
    expect(back.lat).toBeCloseTo(BEIJING.lat + 0.005, 8)
  })
})

describe('GeoReference custom axis mapping', () => {
  it('supports a Z-up ENU convention and validates uniqueness', () => {
    const geo = new GeoReference(BEIJING, { axes: { east: 'x', north: 'y', up: 'z' } })
    const north = geo.toLocal({ lng: BEIJING.lng, lat: BEIJING.lat + 0.001 })
    expect(north.y).toBeGreaterThan(0)
    const up = geo.toLocal({ ...BEIJING, alt: 10 })
    expect(up.z).toBeCloseTo(10, 6)

    expect(() => new GeoReference(BEIJING, { axes: { east: 'x', north: 'x', up: 'z' } })).toThrow()
  })
})

describe('GeoReference helpers', () => {
  it('places an Object3D at a geographic position', () => {
    const geo = new GeoReference(BEIJING)
    const obj = new THREE.Object3D()
    geo.setPosition(obj, { lng: BEIJING.lng, lat: BEIJING.lat + 0.001 })
    expect(obj.position.z).toBeCloseTo(-METERS_PER_DEG_LAT * 0.001, 1)
  })

  it('reports the planar distance between two points', () => {
    const geo = new GeoReference(BEIJING)
    const d = geo.distance(BEIJING, { lng: BEIJING.lng, lat: BEIJING.lat + 0.001 })
    expect(d).toBeCloseTo(METERS_PER_DEG_LAT * 0.001, 1)
  })

  it('exposes an orthonormal ENU basis matrix', () => {
    const geo = new GeoReference(BEIJING)
    const basis = geo.matrix
    const det = basis.determinant()
    expect(Math.abs(det)).toBeCloseTo(1, 6)
  })
})
