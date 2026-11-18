import type { GeoPoint } from './types'

export type GeoJsonPosition = number[]

export interface GeoJsonPoint {
  type: 'Point'
  coordinates: GeoJsonPosition
}

export interface GeoJsonMultiPoint {
  type: 'MultiPoint'
  coordinates: GeoJsonPosition[]
}

export interface GeoJsonLineString {
  type: 'LineString'
  coordinates: GeoJsonPosition[]
}

export interface GeoJsonMultiLineString {
  type: 'MultiLineString'
  coordinates: GeoJsonPosition[][]
}

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: GeoJsonPosition[][]
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon'
  coordinates: GeoJsonPosition[][][]
}

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonMultiPoint
  | GeoJsonLineString
  | GeoJsonMultiLineString
  | GeoJsonPolygon
  | GeoJsonMultiPolygon

export interface GeoJsonFeature {
  type: 'Feature'
  geometry: GeoJsonGeometry | null
  properties?: Record<string, unknown> | null
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export type GeoJsonData = GeoJsonFeatureCollection | GeoJsonFeature | GeoJsonGeometry

/** A single polygon ring: the outer ring followed by zero or more holes. */
export interface GeoJsonRingSet {
  outer: GeoPoint[]
  holes: GeoPoint[][]
}

export interface GeoJsonGeometryData {
  points: GeoPoint[]
  lines: GeoPoint[][]
  polygons: GeoJsonRingSet[]
}

function toGeoPoint(position: GeoJsonPosition): GeoPoint {
  return { lng: position[0], lat: position[1], alt: position[2] ?? 0 }
}

/** Collect every geometry inside a FeatureCollection/Feature/raw geometry. */
export function collectGeometries(data: GeoJsonData): GeoJsonGeometry[] {
  if (data.type === 'FeatureCollection') {
    return data.features
      .map((feature) => feature.geometry)
      .filter((geometry): geometry is GeoJsonGeometry => geometry !== null)
  }
  if (data.type === 'Feature') {
    return data.geometry ? [data.geometry] : []
  }
  return [data]
}

/**
 * Flatten arbitrary GeoJSON into de-duplicated geometry buckets. Positions are
 * kept as geographic points; projecting them to local metres is the renderer's
 * job (see GeoJsonLayer), which keeps this helper pure and unit-testable.
 */
export function flattenGeoJson(data: GeoJsonData): GeoJsonGeometryData {
  const result: GeoJsonGeometryData = { points: [], lines: [], polygons: [] }

  const addLine = (positions: GeoJsonPosition[]) => {
    if (positions.length > 0) result.lines.push(positions.map(toGeoPoint))
  }

  for (const geometry of collectGeometries(data)) {
    switch (geometry.type) {
      case 'Point':
        result.points.push(toGeoPoint(geometry.coordinates))
        break
      case 'MultiPoint':
        geometry.coordinates.forEach((position) => result.points.push(toGeoPoint(position)))
        break
      case 'LineString':
        addLine(geometry.coordinates)
        break
      case 'MultiLineString':
        geometry.coordinates.forEach(addLine)
        break
      case 'Polygon':
        if (geometry.coordinates.length > 0) {
          result.polygons.push({
            outer: geometry.coordinates[0].map(toGeoPoint),
            holes: geometry.coordinates.slice(1).map((ring) => ring.map(toGeoPoint))
          })
        }
        break
      case 'MultiPolygon':
        geometry.coordinates.forEach((polygon) => {
          if (polygon.length > 0) {
            result.polygons.push({
              outer: polygon[0].map(toGeoPoint),
              holes: polygon.slice(1).map((ring) => ring.map(toGeoPoint))
            })
          }
        })
        break
    }
  }

  return result
}
