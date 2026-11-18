---
lang: en-US
title: GeoJsonLayer
---

::: tip type
Component
:::

## Default Usage

`GeoJsonLayer` renders [GeoJSON](https://geojson.org/) data (`FeatureCollection`,
`Feature` or a bare geometry) inside the Scene's `GeoReference`. Supported
geometry types are `Point`, `MultiPoint`, `LineString`, `MultiLineString`,
`Polygon` and `MultiPolygon`, including polygon holes.

- Points render as diamond markers using one merged `LineSegments` draw call.
- Lines render as `LineSegments` rings.
- Polygons render as flat ground fills (`ShapeGeometry`) or extruded blocks
  (`ExtrudeGeometry`) when `extrudeHeight > 0`.
- Returning `null` from `featureStyle` skips a feature entirely.

<GeoJsonLayerDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  >
    <GeoJsonLayer
      :data="data"
      :style="{ strokeColor: 0x9fd0ff, pointColor: 0xffd166, pointSize: 40 }"
      :feature-style="featureStyle"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { GeoJsonLayer } from 'three-vue3'
import type { GeoJsonData, GeoJsonFeature, GeoJsonStyle } from 'three-vue3'

const ORIGIN = { lng: 116.397, lat: 39.909 }
const GRID = { size: 1200, divisions: 24, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

const data: GeoJsonData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'park' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.395, 39.9095],
            [116.399, 39.9095],
            [116.399, 39.9115],
            [116.395, 39.9115],
            [116.395, 39.9095]
          ]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [116.397, 39.909]
      }
    }
  ]
}

const COLORS: Record<string, GeoJsonStyle> = {
  park: { fillColor: 0x4caf50, strokeColor: 0xb9f6ca, opacity: 0.7 }
}

const featureStyle = (feature: GeoJsonFeature): GeoJsonStyle | undefined => {
  const kind = feature.properties?.kind
  return typeof kind === 'string' ? COLORS[kind] : undefined
}

const created = (scene, { camera }) => {
  // A fixed south-side viewpoint looks north over the dataset.
  scene.setPosition(camera, { x: 0, y: 500, z: 700 })
  camera.lookAt(0, 0, 0)
}
</script>
```

:::

## GCJ02 / BD09 Data

When the data itself is encrypted (the typical case for tiles or data exported
from Chinese map services), pass `datum` to the layer or set it once on the
Scene. Coordinates are normalized before projection.

```vue
<GeoJsonLayer :data="amapData" datum="GCJ02" />
```

## Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| data | GeoJsonData | — | A FeatureCollection, Feature or bare geometry object |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | Scene datum | Datum of the feature coordinates |
| style | GeoJsonStyle | see below | Base style for all features |
| featureStyle | (feature: GeoJsonFeature) => GeoJsonStyle \| null \| undefined | — | Per-feature override; `null` skips the feature |
| onReady | (group: THREE.Group) => void | — | Fired when the layer has been built and added |
| scene | THREE.Scene | context scene | Explicit scene for non-Scene usage |

## GeoJsonStyle

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| fillColor | ColorRepresentation | 0x4a90d9 | Polygon fill color |
| strokeColor | ColorRepresentation | 0x9fd0ff | Polygon outline and line string color |
| pointColor | ColorRepresentation | 0xffd166 | Point marker color |
| pointSize | number | 20 | Point marker size in world metres |
| extrudeHeight | number | 0 | Polygon extrusion height in metres; 0 renders flat |
| opacity | number | 0.85 | Fill opacity |

## Events

| Name | Parameters | Description |
|------|------------|-------------|
| onReady | (group: THREE.Group) => void | Fired once after the layer group is added to the scene |
