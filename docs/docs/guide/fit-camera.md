---
lang: en-US
title: Fit Camera
---

::: tip type
Class / Function
:::

`FitCamera` is a `THREE.PerspectiveCamera` with framing helpers, and the same helpers are also exported as plain functions. They compute the camera distance from the content bounding box, so you never hard-code a viewpoint or a far plane for a specific model scale.

## Default Usage

<FitCameraDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" :camera="camera" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { FitCamera } from 'three-vue3'

const camera = new FitCamera(45, 1, 0.1, 2000)

const created = (scene, { controls }) => {
  const group = new THREE.Group()
  const geometry = new THREE.SphereGeometry(0.4, 16, 16)
  const material = new THREE.MeshLambertMaterial({ color: 0xff7a45 })

  for (let i = 0; i < 12; i++) {
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(Math.cos(i) * 6, (i % 3) - 1, Math.sin(i) * 6)
    group.add(sphere)
  }

  scene.add(group)

  // Frame the whole group in a single call.
  if (controls) camera.bind(controls).fitToObject(group)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Functions

The class methods delegate to these functions, which accept any `THREE.PerspectiveCamera`.

```ts
import { fitCameraToBox, fitCameraToObject, fitCameraToPoints } from 'three-vue3'

fitCameraToObject(camera, model, { elevation: Math.PI / 6, padding: 1.6 })
```

## Options

| Name      | Type                        | Default    | Description                                                               |
| --------- | --------------------------- | ---------- | ------------------------------------------------------------------------- |
| elevation | number                      | `PI / 4`   | `optional` Viewing elevation above the horizontal plane, in radians.      |
| azimuth   | number                      | `PI / 4`   | `optional` Horizontal bearing around the target, clockwise from -Z.       |
| padding   | number                      | `1.4`      | `optional` Distance multiplier, `> 1` zooms out for margin.                |
| distance  | number                      |            | `optional` Overrides the computed distance, in world units.                |
| adjustClip| boolean                     | `true`     | `optional` Derives `near` / `far` from the content scale.                  |
| controls  | OrbitControls \| null       | `null`     | `optional` When supplied, its `target` is synced to the box centre.        |

## Methods

| Name          | Parameters                                                        | Description                              |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| bind          | (controls?: OrbitControls \| null) => this                        | Binds the controls used by later fits.   |
| fitToPoints   | (points: LocalPoint[], options?: CameraFitOptions) => this        | Frames a set of local-space points.      |
| fitToObject   | (object: Object3D \| Object3D[], options?: CameraFitOptions) => this | Frames the world-space bounding box.  |
| fitToBox      | (box: THREE.Box3, options?: CameraFitOptions) => this             | Frames an explicit world-space box.      |
