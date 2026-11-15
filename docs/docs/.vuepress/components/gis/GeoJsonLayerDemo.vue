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
import * as THREE from 'three'
import { GeoJsonLayer } from 'three-vue3'
import type { GeoJsonData, GeoJsonFeature, GeoJsonStyle } from 'three-vue3'

const ORIGIN = { lng: 116.397, lat: 39.909 }

// City-scale grid options; Scene builds and disposes the GridHelper.
const GRID = { size: 1200, divisions: 24, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

// Geometry authored once as plain GeoJSON; GeoJsonLayer builds every three.js
// object (points, lines, polygon meshes) internally.
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
      properties: { kind: 'block' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.3972, 39.9068],
            [116.3992, 39.9068],
            [116.3992, 39.9084],
            [116.3972, 39.9084],
            [116.3972, 39.9068]
          ]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [116.394, 39.9075],
          [116.4005, 39.9075],
          [116.4005, 39.9125]
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
  park: { fillColor: 0x4caf50, strokeColor: 0xb9f6ca, opacity: 0.7 },
  block: { fillColor: 0xff7043, strokeColor: 0xffab91, opacity: 0.7 }
}

const featureStyle = (feature: GeoJsonFeature): GeoJsonStyle | undefined => {
  const kind = feature.properties?.kind
  return typeof kind === 'string' ? COLORS[kind] : undefined
}

const created = (scene: THREE.Scene, { camera }: { camera: THREE.PerspectiveCamera }) => {
  // A fixed south-side viewpoint looks north over the dataset; the scene places
  // the camera from local metres, so the view stays north-up.
  scene.setPosition(camera, { x: 0, y: 500, z: 700 })
  camera.lookAt(0, 0, 0)
}
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
