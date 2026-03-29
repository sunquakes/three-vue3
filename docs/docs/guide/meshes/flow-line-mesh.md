---
lang: en-US
title: Flow Line Mesh
---

::: tip type
Class
:::

## Default Usage

<FlowLineMesh />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="flow-line" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh, AxisType } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(-1.5, 0.3, 0),
  new THREE.Vector3(-1, 0.5, 0),
  new THREE.Vector3(-0.5, 0.6, 0),
  new THREE.Vector3(0, 0.6, 0),
  new THREE.Vector3(0.5, 0.6, 0),
  new THREE.Vector3(1, 0.5, 0),
  new THREE.Vector3(1.5, 0.3, 0),
  new THREE.Vector3(2, 0, 0)
]
const mesh = new FlowLineMesh({ 
  points,
  width: 0.3,
  axis: AxisType.Z,
  textureRepeat: 8,
  speed: 16,
  color: [0.0, 1.0, 1.0, 1]
})
const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // Add mesh to scene.
  scene.add(mesh)
}
</script>

<style>
.flow-line {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Custom Options

<FlowLineMeshOptions />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="flow-line" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-2.5, 0, 0),
  new THREE.Vector3(-2, 0.4, 0),
  new THREE.Vector3(-1.5, 0.7, 0),
  new THREE.Vector3(-1, 0.9, 0),
  new THREE.Vector3(-0.5, 1, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.5, 1, 0),
  new THREE.Vector3(1, 0.9, 0),
  new THREE.Vector3(1.5, 0.7, 0),
  new THREE.Vector3(2, 0.4, 0),
  new THREE.Vector3(2.5, 0, 0)
]
const mesh = new FlowLineMesh({
  points,
  color: [0.0, 1.0, 1.0, 1],
  speed: 16,
  width: 0.4,
  axis: AxisType.Z,
  textureRepeat: 10
})
const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // Add mesh to scene.
  scene.add(mesh)
}
</script>

<style>
.flow-line {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Constructor Parameters

| Paramter | Props  | Type                | Default                                      | Description                                                                       |
| -------- | ------ | ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| options  | points | THREE.Vector3[]     | `[-1,0,0], [0,0.5,0], [1,0,0]`              | `optional` Array of 3D points that define the line path.                          |
|          | color  | [number, number, number, number] | [0.6, 0.96, 0.98, 1] | `optional` The color of the flow line (RGBA).                                     |
|          | speed  | number              | 1                                            | `optional` The speed of the flow animation.                                       |
|          | width  | number              | 0.05                                         | `optional` The width of the line.                                                 |
|          | axis   | AxisType            | AxisType.Z                                   | `optional` The axis the line faces. `X`, `Y`, or `Z`.                             |
