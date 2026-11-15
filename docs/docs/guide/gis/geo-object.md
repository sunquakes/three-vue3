---
lang: en-US
title: GeoObject
---

::: tip type
Component
:::

## Default Usage

`GeoObject` anchors an `Object3D` at a geographic coordinate. Without an
`object` prop it creates an empty `THREE.Group` and hands it to `onReady`,
where you can add markers, labels or loaded models. Updating `coordinate` or
`datum` moves the object in place without rebuilding it.

<GeoObjectDemo />

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
    <GeoObject
      v-for="(marker, index) in MARKERS"
      :key="index"
      :coordinate="marker"
      datum="GCJ02"
      :object="anchors[index]"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

// Scene origin in WGS84; the anchored markers are GCJ02 coordinates as
// returned by AMap/Tencent services.
const ORIGIN: GeoPoint = { lng: 116.391, lat: 39.907 }
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }
const MARKERS: GeoPoint[] = [
  { lng: 116.397428, lat: 39.90923 },
  { lng: 116.4005, lat: 39.9117 },
  { lng: 116.3945, lat: 39.912 }
]

// Anchors are built in the scene `created` handler, never at module scope.
const anchors = shallowRef<THREE.Object3D[]>([])

const created = (scene, { camera }) => {
  // A raised south-side viewpoint looks north over the markers.
  scene.setPosition(camera, { x: 0, y: 750, z: 1000 })
  camera.lookAt(0, 0, 0)

  anchors.value = MARKERS.map(() => {
    const anchor = new THREE.Group()
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(40, 120, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    )
    cone.position.y = 60
    anchor.add(cone)
    return anchor
  })
}

onBeforeUnmount(() => {
  // Externally supplied objects stay owned by the demo.
  anchors.value.forEach((anchor) => {
    anchor.removeFromParent()
    anchor.traverse((child) => {
      const mesh = child as THREE.Mesh
      mesh.geometry?.dispose()
      ;(mesh.material as THREE.Material | undefined)?.dispose()
    })
  })
  anchors.value = []
})
</script>
```

:::

## Anchoring an Existing Object

Passing your own `Object3D` keeps ownership with the caller: the component
reparents it into the Scene and restores the original parent on unmount.

```vue
<script lang="ts" setup>
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

const coordinate: GeoPoint = { lng: 116.397, lat: 39.909 }
const model = new THREE.Group()
</script>

<template>
  <GeoObject :coordinate="coordinate" :object="model" />
</template>
```

## Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| coordinate | GeoPoint | — | Geographic anchor in the datum declared by `datum` |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | Scene datum | Datum of `coordinate` |
| object | THREE.Object3D | creates a Group | Existing object to anchor |
| onReady | (object: THREE.Object3D) => void | — | Called once with the anchored object |
| scene | THREE.Scene | context scene | Explicit scene for non-Scene usage |

## Events

| Name | Parameters | Description |
|------|------------|-------------|
| onReady | (object: THREE.Object3D) => void | Fired when the object has been added and positioned |
