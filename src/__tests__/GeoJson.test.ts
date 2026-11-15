import { describe, expect, it } from 'vitest'
import { collectGeometries, flattenGeoJson } from '../crs/GeoJson'
import type { GeoJsonData } from '../crs/GeoJson'

const collection: GeoJsonData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [116.4, 39.9, 10] },
      properties: { name: 'marker' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [116.4, 39.9],
            [116.41, 39.91]
          ],
          [
            [116.42, 39.92],
            [116.43, 39.93]
          ]
        ]
      },
      properties: null
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.4, 39.9],
            [116.41, 39.9],
            [116.41, 39.91],
            [116.4, 39.9]
          ],
          [
            [116.404, 39.904],
            [116.406, 39.904],
            [116.406, 39.906],
            [116.404, 39.904]
          ]
        ]
      },
      properties: { height: 50 }
    },
    { type: 'Feature', geometry: null, properties: null }
  ]
}

describe('flattenGeoJson', () => {
  it('buckets points, lines and polygon rings', () => {
    const flat = flattenGeoJson(collection)
    expect(flat.points).toHaveLength(1)
    expect(flat.points[0]).toEqual({ lng: 116.4, lat: 39.9, alt: 10 })
    expect(flat.lines).toHaveLength(2)
    expect(flat.lines[0]).toHaveLength(2)
    expect(flat.polygons).toHaveLength(1)
    expect(flat.polygons[0].outer).toHaveLength(4)
    expect(flat.polygons[0].holes).toHaveLength(1)
  })

  it('defaults missing altitude to zero', () => {
    const flat = flattenGeoJson({ type: 'Point', coordinates: [1, 2] })
    expect(flat.points[0].alt).toBe(0)
  })

  it('expands multi-point and multi-polygon geometries', () => {
    const flat = flattenGeoJson({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0]
          ]
        ],
        [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 2]
          ]
        ]
      ]
    })
    expect(flat.polygons).toHaveLength(2)
  })

  it('skips null feature geometries while collecting', () => {
    const geometries = collectGeometries(collection)
    expect(geometries).toHaveLength(3)
  })

  it('accepts a single bare geometry', () => {
    const flat = flattenGeoJson({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1]
      ]
    })
    expect(flat.lines[0][1]).toEqual({ lng: 1, lat: 1, alt: 0 })
  })
})
