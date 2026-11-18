---
lang: en-US
title: Sky Dome
---

::: tip type
Class
:::

`SkyDome` is a gradient sky sphere with a low sun: four color bands rising from the horizon to the zenith, a wide halo, and a round sun disc. It is built with a TSL node material, so the same class runs on the WebGPU renderer and on WebGL through `WebGLNodesHandler`.

When no `sunDirection` is passed, the dome follows `globalParameterBus`, so moving the shared sun updates the sky automatically.

## Default Usage

<SkyDomeDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { SkyDome, globalParameterBus } from 'three-vue3'

let dome: SkyDome | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0.8, 7)
  camera.lookAt(0, 0.8, 0)

  // One shared sun direction drives every effect in the scene.
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.78, 0.2, -0.6))

  dome = new SkyDome()
  scene.add(dome)
}

onBeforeUnmount(() => {
  dome?.dispose()
  dome = undefined
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Options

| Name          | Type                          | Default               | Description                                        |
| ------------- | ----------------------------- | --------------------- | -------------------------------------------------- |
| radius        | number                        | `420`                 | `optional` Radius of the dome sphere.              |
| horizonColor  | number                        | `0xf27536`            | `optional` Color of the band on the horizon.       |
| lowerSkyColor | number                        | `0x803624`            | `optional` Color just above the horizon.           |
| upperSkyColor | number                        | `0x260f13`            | `optional` Color of the intermediate band.         |
| zenithColor   | number                        | `0x060409`            | `optional` Color at the top of the dome.           |
| sunDirection  | [number, number, number]      | from the parameter bus | `optional` Sun direction, normalized internally.  |
| glowColor     | number                        | `0xff9947`            | `optional` Color of the halo around the sun.       |
| sunColor      | number                        | `0xffe0b8`            | `optional` Color of the sun disc.                  |
| sunIntensity  | number                        | `2.4`                 | `optional` Brightness multiplier of the sun disc.  |
| sunSize       | number                        | `10`                  | `optional` Angular diameter of the disc, in degrees. |
| segments      | number                        | `48`                  | `optional` Horizontal segment count of the sphere. |

## Methods

| Name           | Parameters                                          | Description                                |
| -------------- | --------------------------------------------------- | ------------------------------------------ |
| setSunDirection| (direction: THREE.Vector3 \| [number, number, number]) => void | Points the dome at a new sun direction. |
| dispose        | () => void                                          | Unsubscribes and releases geometry/material. |
