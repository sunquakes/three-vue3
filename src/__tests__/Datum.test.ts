import { describe, expect, it } from 'vitest'
import { wgs84ToGcj02, gcj02ToWgs84, gcj02ToBd09, bd09ToGcj02, convertDatum } from '../crs/Datum'

const BEIJING = { lng: 116.404, lat: 39.915 }

describe('Datum transforms', () => {
  it('shifts mainland China WGS84 coordinates to GCJ02', () => {
    const gcj = wgs84ToGcj02(BEIJING)
    expect(gcj.lng).not.toBe(BEIJING.lng)
    expect(gcj.lat).not.toBe(BEIJING.lat)
    // The encryption offset in Beijing is a few hundred metres (<0.01 degree).
    expect(Math.abs(gcj.lng - BEIJING.lng)).toBeLessThan(0.01)
    expect(Math.abs(gcj.lat - BEIJING.lat)).toBeLessThan(0.01)
  })

  it('leaves coordinates outside mainland China untouched', () => {
    const overseas = { lng: -74.006, lat: 40.7128 }
    expect(wgs84ToGcj02(overseas)).toEqual(overseas)
    expect(gcj02ToWgs84(overseas)).toEqual(overseas)
  })

  it('round-trips GCJ02 -> WGS84 -> GCJ02 to within a fraction of a metre', () => {
    const gcj = wgs84ToGcj02(BEIJING)
    const wgs = gcj02ToWgs84(gcj)
    const again = wgs84ToGcj02(wgs)
    // ~1e-7 degree is about 1 cm; fixed-point iteration is far tighter than that.
    expect(again.lng).toBeCloseTo(gcj.lng, 6)
    expect(again.lat).toBeCloseTo(gcj.lat, 6)
  })

  it('round-trips GCJ02 <-> BD09', () => {
    const gcj = wgs84ToGcj02(BEIJING)
    const bd = gcj02ToBd09(gcj)
    expect(bd.lng).not.toBe(gcj.lng)
    const back = bd09ToGcj02(bd)
    expect(back.lng).toBeCloseTo(gcj.lng, 5)
    expect(back.lat).toBeCloseTo(gcj.lat, 5)
  })

  it('preserves altitude through every transform', () => {
    const withAlt = { ...BEIJING, alt: 42 }
    expect(wgs84ToGcj02(withAlt).alt).toBe(42)
    expect(convertDatum(withAlt, 'WGS84', 'BD09').alt).toBe(42)
  })

  it('returns the same point when source and target datum match', () => {
    expect(convertDatum(BEIJING, 'GCJ02', 'GCJ02')).toBe(BEIJING)
  })

  it('converts WGS84 directly to BD09 and back', () => {
    const bd = convertDatum(BEIJING, 'WGS84', 'BD09')
    const wgs = convertDatum(bd, 'BD09', 'WGS84')
    expect(wgs.lng).toBeCloseTo(BEIJING.lng, 5)
    expect(wgs.lat).toBeCloseTo(BEIJING.lat, 5)
  })
})
