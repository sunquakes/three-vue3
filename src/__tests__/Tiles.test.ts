import { describe, expect, it } from 'vitest'
import {
  TILE_SIZE,
  lngLatToTile,
  tileToLngLatBounds,
  tileToCorners,
  selectTiles,
  selectTilesInBounds,
  tileUrl
} from '../crs/Tiles'

describe('TILE_SIZE', () => {
  it('matches the standard XYZ raster tile edge length', () => {
    expect(TILE_SIZE).toBe(256)
  })
})

describe('lngLatToTile', () => {
  it('maps every point on Earth to tile 0/0/0 at zoom 0', () => {
    expect(lngLatToTile(0, 0, 0)).toEqual({ z: 0, x: 0, y: 0 })
    expect(lngLatToTile(116.4, 39.9, 0)).toEqual({ z: 0, x: 0, y: 0 })
    expect(lngLatToTile(-74, 40.7, 0)).toEqual({ z: 0, x: 0, y: 0 })
  })

  it('locates the origin meridian at zoom 1', () => {
    expect(lngLatToTile(0, 0, 1)).toEqual({ z: 1, x: 1, y: 1 })
    expect(lngLatToTile(-90, 0, 1)).toEqual({ z: 1, x: 0, y: 1 })
    expect(lngLatToTile(90, 0, 1)).toEqual({ z: 1, x: 1, y: 1 })
  })

  it('wraps column indices across the antimeridian', () => {
    expect(lngLatToTile(180, 0, 1)).toEqual({ z: 1, x: 0, y: 1 })
    expect(lngLatToTile(-180, 0, 1)).toEqual({ z: 1, x: 0, y: 1 })
  })

  it('clamps polar latitudes to the Web Mercator limit', () => {
    expect(lngLatToTile(0, 88, 2)).toEqual({ z: 2, x: 2, y: 0 })
    expect(lngLatToTile(0, -88, 2)).toEqual({ z: 2, x: 2, y: 3 })
  })

  it('rejects invalid zoom levels', () => {
    expect(() => lngLatToTile(0, 0, -1)).toThrow(RangeError)
    expect(() => lngLatToTile(0, 0, 1.5)).toThrow(RangeError)
  })
})

describe('tileToLngLatBounds', () => {
  it('returns the full Web Mercator world for the zoom 0 tile', () => {
    const bounds = tileToLngLatBounds({ z: 0, x: 0, y: 0 })
    expect(bounds.west).toBeCloseTo(-180, 10)
    expect(bounds.east).toBeCloseTo(180, 10)
    expect(bounds.north).toBeCloseTo(85.05112878, 6)
    expect(bounds.south).toBeCloseTo(-85.05112878, 6)
  })

  it('splits the world into four equal-width quadrants at zoom 1', () => {
    const nw = tileToLngLatBounds({ z: 1, x: 0, y: 0 })
    expect(nw.west).toBeCloseTo(-180, 10)
    expect(nw.east).toBeCloseTo(0, 10)
    expect(nw.north).toBeCloseTo(85.05112878, 6)
    expect(nw.south).toBeCloseTo(0, 10)
  })

  it('is the inverse of lngLatToTile for points away from edges', () => {
    const samples: [number, number, number][] = [
      [116.4074, 39.9042, 10],
      [-74.006, 40.7128, 8],
      [139.6917, 35.6895, 12],
      [-0.1276, 51.5074, 6]
    ]
    samples.forEach(([lng, lat, zoom]) => {
      const index = lngLatToTile(lng, lat, zoom)
      const bounds = tileToLngLatBounds(index)
      expect(lng).toBeGreaterThanOrEqual(bounds.west)
      expect(lng).toBeLessThan(bounds.east)
      expect(lat).toBeLessThanOrEqual(bounds.north)
      expect(lat).toBeGreaterThan(bounds.south)
    })
  })

  it('wraps out-of-range column and row indices', () => {
    const count = 2 ** 2
    expect(tileToLngLatBounds({ z: 2, x: count, y: 0 }).west).toBeCloseTo(-180, 10)
    expect(tileToLngLatBounds({ z: 2, x: 0, y: count }).south).toBeCloseTo(-85.05112878, 6)
  })
})

describe('tileToCorners', () => {
  it('returns corners in NW/NE/SE/SW reading order', () => {
    const corners = tileToCorners({ z: 1, x: 1, y: 1 })
    expect(corners.nw.lng).toBeCloseTo(0, 10)
    expect(corners.nw.lat).toBeCloseTo(0, 10)
    expect(corners.ne.lng).toBeCloseTo(180, 10)
    expect(corners.ne.lat).toBeCloseTo(0, 10)
    expect(corners.se.lng).toBeCloseTo(180, 10)
    expect(corners.se.lat).toBeCloseTo(-85.05112878, 6)
    expect(corners.sw.lng).toBeCloseTo(0, 10)
    expect(corners.sw.lat).toBeCloseTo(-85.05112878, 6)
  })
})

describe('selectTiles', () => {
  it('returns no tiles for empty coverage', () => {
    expect(selectTiles([], 5)).toEqual([])
  })

  it('selects the single containing tile for one point', () => {
    expect(selectTiles([{ lng: 116.4, lat: 39.9 }], 0)).toEqual([{ z: 0, x: 0, y: 0 }])
  })

  it('fills the tile bounding rectangle between two points', () => {
    const tiles = selectTiles(
      [
        { lng: 116.3, lat: 39.95 },
        { lng: 116.5, lat: 39.85 }
      ],
      12
    )
    const nw = lngLatToTile(116.3, 39.95, 12)
    const se = lngLatToTile(116.5, 39.85, 12)
    const expectedColumns = se.x - nw.x + 1
    const expectedRows = se.y - nw.y + 1
    expect(tiles.length).toBe(expectedColumns * expectedRows)
    expect(new Set(tiles.map((tile) => `${tile.x}/${tile.y}`)).size).toBe(tiles.length)
    tiles.forEach((tile) => {
      expect(tile.z).toBe(12)
      expect(tile.x).toBeGreaterThanOrEqual(nw.x)
      expect(tile.x).toBeLessThanOrEqual(se.x)
      expect(tile.y).toBeGreaterThanOrEqual(nw.y)
      expect(tile.y).toBeLessThanOrEqual(se.y)
    })
  })

  it('is datum-neutral: shifted coordinates still select a coherent rectangle', () => {
    const tiles = selectTiles(
      [
        { lng: 116.3, lat: 39.95 },
        { lng: 116.305, lat: 39.945 }
      ],
      14
    )
    expect(tiles.length).toBeGreaterThan(0)
    tiles.forEach((tile) => expect(tile.z).toBe(14))
  })

  it('rejects invalid zoom levels', () => {
    expect(() => selectTiles([{ lng: 0, lat: 0 }], -2)).toThrow(RangeError)
  })
})

describe('selectTilesInBounds', () => {
  it('selects every tile intersecting the bounding rectangle', () => {
    const zoom = 12
    const west = 116.3
    const south = 39.85
    const east = 116.5
    const north = 39.95
    const tiles = selectTilesInBounds(west, south, east, north, zoom)
    const nw = lngLatToTile(west, north, zoom)
    const se = lngLatToTile(east, south, zoom)
    expect(tiles.length).toBe((se.x - nw.x + 1) * (se.y - nw.y + 1))
    expect(new Set(tiles.map((tile) => `${tile.x}/${tile.y}`)).size).toBe(tiles.length)
    tiles.forEach((tile) => {
      expect(tile.z).toBe(zoom)
      expect(tile.x).toBeGreaterThanOrEqual(nw.x)
      expect(tile.x).toBeLessThanOrEqual(se.x)
      expect(tile.y).toBeGreaterThanOrEqual(nw.y)
      expect(tile.y).toBeLessThanOrEqual(se.y)
    })
  })

  it('expands the rectangle by padding tiles on every side', () => {
    const zoom = 10
    const west = 116.3
    const south = 39.85
    const east = 116.35
    const north = 39.9
    const nw = lngLatToTile(west, north, zoom)
    const se = lngLatToTile(east, south, zoom)
    const tiles = selectTilesInBounds(west, south, east, north, zoom, 1)
    expect(tiles.length).toBe((se.x - nw.x + 3) * (se.y - nw.y + 3))
    tiles.forEach((tile) => {
      expect(tile.x).toBeGreaterThanOrEqual(nw.x - 1)
      expect(tile.x).toBeLessThanOrEqual(se.x + 1)
      expect(tile.y).toBeGreaterThanOrEqual(nw.y - 1)
      expect(tile.y).toBeLessThanOrEqual(se.y + 1)
    })
  })

  it('wraps columns when the rectangle crosses the antimeridian', () => {
    const zoom = 3
    const west = 170
    const east = -170
    const tiles = selectTilesInBounds(west, -10, east, 10, zoom)
    const nw = lngLatToTile(west, 10, zoom)
    const se = lngLatToTile(east, -10, zoom)
    const expectedColumns = ((se.x - nw.x + 2 ** zoom) % 2 ** zoom) + 1
    expect(tiles.length).toBe(expectedColumns * (se.y - nw.y + 1))
    expect(tiles.map((tile) => tile.x)).toContain(0)
    expect(tiles.map((tile) => tile.x)).toContain(2 ** zoom - 1)
  })

  it('clamps rows at the poles without producing duplicates', () => {
    const zoom = 2
    const tiles = selectTilesInBounds(-180, -90, 180, 90, zoom)
    expect(new Set(tiles.map((tile) => `${tile.x}/${tile.y}`)).size).toBe(tiles.length)
    tiles.forEach((tile) => {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x).toBeLessThan(2 ** zoom)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThan(2 ** zoom)
    })
  })

  it('rejects invalid zoom levels', () => {
    expect(() => selectTilesInBounds(0, 0, 1, 1, -1)).toThrow(RangeError)
    expect(() => selectTilesInBounds(0, 0, 1, 1, 2.5)).toThrow(RangeError)
  })
})

describe('tileUrl', () => {
  const index = { z: 3, x: 4, y: 5 }

  it('fills the z/x/y tokens', () => {
    expect(tileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png', index)).toBe(
      'https://tile.openstreetmap.org/3/4/5.png'
    )
  })

  it('cycles the {s} subdomain deterministically', () => {
    const template = 'https://{s}.tiles.example.com/{z}/{x}/{y}.png'
    expect(tileUrl(template, { z: 3, x: 0, y: 0 })).toBe('https://a.tiles.example.com/3/0/0.png')
    expect(tileUrl(template, { z: 3, x: 0, y: 1 })).toBe('https://b.tiles.example.com/3/0/1.png')
    expect(tileUrl(template, { z: 3, x: 0, y: 2 })).toBe('https://c.tiles.example.com/3/0/2.png')
    expect(tileUrl(template, { z: 3, x: 0, y: 3 })).toBe('https://a.tiles.example.com/3/0/3.png')
  })

  it('accepts a custom subdomain list', () => {
    expect(tileUrl('https://{s}.tiles.example.com/{z}/{x}/{y}.png', index, ['web0', 'web1'])).toBe(
      'https://web1.tiles.example.com/3/4/5.png'
    )
  })
})
