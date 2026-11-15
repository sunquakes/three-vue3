---
lang: en-US
title: Model Rotator
---

::: tip type
Class
:::

`ModelRotator` spins any `THREE.Object3D` on its own `requestAnimationFrame` loop, keeping the animation independent of the scene render loop. Pause, resume, change speed or axis at any time, and call `dispose()` when the model is removed.

## Default Usage

<ModelRotatorDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, ModelRotator } from 'three-vue3'
import type * as THREE from 'three'

let rotator: ModelRotator | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.position.set(0, 0, 0)
  scene.add(model)

  rotator = new ModelRotator(model, {
    axis: 'y',
    speed: 0.5,
    autoStart: true
  })
}

onBeforeUnmount(() => {
  rotator?.dispose()
  rotator = undefined
  if (model) {
    model.parent?.remove(model)
    model = undefined
  }
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

| Name      | Type                  | Default | Description                                          |
| --------- | --------------------- | ------- | ---------------------------------------------------- |
| axis      | 'x' \| 'y' \| 'z'     | `'y'`   | `optional` Rotation axis.                            |
| speed     | number                | `0.5`   | `optional` Rotation speed in radians per second.     |
| autoStart | boolean               | `true`  | `optional` Start rotating when the instance is created. |

## Methods

| Name     | Parameters              | Description                                  |
| -------- | ----------------------- | -------------------------------------------- |
| play     | () => void              | Starts or resumes rotation.                  |
| pause    | () => void              | Pauses rotation, keeping the current angle.  |
| stop     | () => void              | Pauses and resets the rotation to zero.      |
| setSpeed | (speed: number) => void | Updates the rotation speed.                  |
| setAxis  | (axis: 'x' \| 'y' \| 'z') => void | Updates the rotation axis.         |
| dispose  | () => void              | Stops the loop and releases the animation frame. |
