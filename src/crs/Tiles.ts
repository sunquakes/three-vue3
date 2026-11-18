import { DEG2RAD, RAD2DEG, MERCATOR_MAX_LAT } from './constants'
import type { GeoPoint } from './types'

/** Edge length of a standard XYZ raster tile in pixels. */
export const TILE_SIZE = 256

/** Slippy-map tile address: zoom level z and column/row indices x/y. */
export interface TileIndex {
  z: number
  x: number
  y: number
}

/** Geographic bounding box of a tile, in degrees. */
export interface TileBounds {
  west: number
  north: number
  east: number
  south: number
}

/** Four geographic corners of a tile in reading order: NW, NE, SE, SW. */
export interface TileCorners {
  nw: GeoPoint
  ne: GeoPoint
  se: GeoPoint
  sw: GeoPoint
}

function assertZoom(zoom: number): void {
  if (!Number.isInteger(zoom) || zoom < 0) {
    throw new RangeError(`Tile zoom must be a non-negative integer, received ${zoom}`)
  }
}

function wrapTileX(x: number, count: number): number {
  return ((x % count) + count) % count
}

function clampTileY(y: number, count: number): number {
  return Math.min(count - 1, Math.max(0, y))
}

/**
 * Locate the XYZ tile that covers a geographic point at the given zoom.
 * Longitudes wrap around the antimeridian; latitudes are clamped to the
 * Web Mercator limit (~85.0511 degrees).
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): TileIndex {
  assertZoom(zoom)
  const count = 2 ** zoom
  const clampedLat = Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat))
  const x = Math.floor(((lng + 180) / 360) * count)
  const y = Math.floor(((1 - Math.asinh(Math.tan(clampedLat * DEG2RAD)) / Math.PI) / 2) * count)
  return { z: zoom, x: wrapTileX(x, count), y: clampTileY(y, count) }
}

/** Inverse of lngLatToTile: geographic bounds (degrees) of a single tile. */
export function tileToLngLatBounds(index: TileIndex): TileBounds {
  const { z, x, y } = index
  assertZoom(z)
  const count = 2 ** z
  const column = wrapTileX(x, count)
  const row = clampTileY(y, count)
  const west = (column / count) * 360 - 180
  const east = ((column + 1) / count) * 360 - 180
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / count))) * RAD2DEG
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (row + 1)) / count))) * RAD2DEG
  return { west, north, east, south }
}

/** Geographic corners of a tile, ready to project onto the local plane. */
export function tileToCorners(index: TileIndex): TileCorners {
  const { west, north, east, south } = tileToLngLatBounds(index)
  return {
    nw: { lng: west, lat: north },
    ne: { lng: east, lat: north },
    se: { lng: east, lat: south },
    sw: { lng: west, lat: south }
  }
}

/**
 * Select every tile that covers the given geographic points at one zoom level
 * (the bounding rectangle of the points is filled). The math is datum-neutral:
 * pass lng/lat in the same datum the tile imagery uses (WGS84 for OSM, GCJ02
 * for AMap/Tencent), and place the returned tiles with matching corners.
 */
export function selectTiles(points: GeoPoint[], zoom: number): TileIndex[] {
  assertZoom(zoom)
  if (!points || points.length === 0) return []

  const count = 2 ** zoom
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  points.forEach((point) => {
    const tile = lngLatToTile(point.lng, point.lat, zoom)
    minX = Math.min(minX, tile.x)
    maxX = Math.max(maxX, tile.x)
    minY = Math.min(minY, tile.y)
    maxY = Math.max(maxY, tile.y)
  })

  const tiles: TileIndex[] = []
  for (let row = minY; row <= maxY; row++) {
    for (let column = minX; column <= maxX; column++) {
      tiles.push({ z: zoom, x: wrapTileX(column, count), y: clampTileY(row, count) })
    }
  }
  return tiles
}

/**
 * Select every tile intersecting a geographic bounding rectangle given as
 * west/south/east/north degrees, optionally expanded by `padding` tiles on
 * every side. The rectangle may cross the antimeridian (east < west after
 * normalization is handled by column wrapping); rows are clamped at the poles.
 * Duplicates produced by clamping/wrapping at low zooms are removed.
 */
export function selectTilesInBounds(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: number,
  padding = 0
): TileIndex[] {
  assertZoom(zoom)
  const count = 2 ** zoom
  const nw = lngLatToTile(west, north, zoom)
  const se = lngLatToTile(east, south, zoom)

  const spanX = ((se.x - nw.x + count) % count) + 1 + 2 * padding
  const spanY = se.y - nw.y + 1 + 2 * padding

  const seen = new Set<string>()
  const tiles: TileIndex[] = []
  for (let dy = 0; dy < spanY; dy++) {
    const row = clampTileY(nw.y - padding + dy, count)
    for (let dx = 0; dx < spanX; dx++) {
      const column = wrapTileX(nw.x - padding + dx, count)
      const key = `${column}_${row}`
      if (seen.has(key)) continue
      seen.add(key)
      tiles.push({ z: zoom, x: column, y: row })
    }
  }
  return tiles
}

/**
 * Fill an XYZ URL template. Supported tokens: {z}, {x}, {y} and the optional
 * {s} subdomain placeholder (cycles deterministically through `subdomains`,
 * defaulting to a/b/c).
 */
export function tileUrl(template: string, index: TileIndex, subdomains?: string[]): string {
  const hosts = subdomains && subdomains.length > 0 ? subdomains : ['a', 'b', 'c']
  const subdomain = hosts[Math.abs(index.x + index.y) % hosts.length]
  return template
    .replace('{s}', subdomain)
    .replace('{z}', String(index.z))
    .replace('{x}', String(index.x))
    .replace('{y}', String(index.y))
}
