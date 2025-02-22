---
lang: en-US
title: Wave Circle Mesh
---

::: tip type
Class
:::

## Default Usage

<WaveCircleMesh />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh } from 'three-vue3'

const mesh = new WaveCircleMesh()
const created = (scene, { camera }) => {
  camera.position.set(0, 2, 0)

  // Add mesh to scene.
  scene.add(mesh)
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Custom Options

<WaveCircleMeshOptions />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh, AxisType } from 'three-vue3'

const mesh = new WaveCircleMesh({
  radius: 0.5,
  color: [0.98, 0.61, 0.6, 1],
  speed: 2,
  verticalAxis: AxisType.X
})
const created = (scene, { camera }) => {
  camera.position.set(2, 0, 0)

  // Add mesh to scene.
  scene.add(mesh)
  mesh.position.set(...[0, 0.5, 0])
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Constructor Parameters

| Paramter | Props        | Type                             | Default              | Description                                                                       |
| -------- | ------------ | -------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| options  | radius       | number                           | 1                    | `optional` The radius of the wave circle.                                         |
|          | color        | [number, number, number, number] | [0.6, 0.96, 0.98, 1] | `optional` The color of the wave circle.                                          |
|          | speed        | number                           | 1                    | `optional` The speed of the circle wave.                                          |
|          | verticalAxis | AxisType                         | AxisType.Y           | `optional` The circle face vertical axis. The type AxisType is `X` or `Y` or `Z`. |
