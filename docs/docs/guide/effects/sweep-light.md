---
lang: en-US
title: Sweep Light
---

::: tip type
Class
:::

`SweepLight` sweeps an additive light band along one axis across every mesh of a target object. It clones the geometry of each mesh and draws it with a band shader, so the original materials stay untouched and the model keeps its look. The sweep runs from its own animation loop — no per-frame code is needed.

## Default Usage

<SweepLightDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, SweepLight } from 'three-vue3'
import type * as THREE from 'three'

let effect: SweepLight | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // The sweep is drawn over the model's surface.
  effect = new SweepLight(model)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
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

| Name      | Type                                        | Default      | Description                                              |
| --------- | ------------------------------------------- | ------------ | -------------------------------------------------------- |
| color     | number                                      | `0x00ffff`   | `optional` Sweep light color.                            |
| speed     | number                                      | `0.5`        | `optional` Sweep speed, one pass takes `2 / speed` secs. |
| width     | number                                      | `0.3`        | `optional` Band width in the 0-1 range of the sweep axis. |
| intensity | number                                      | `1.5`        | `optional` Light intensity.                              |
| direction | number                                      | `0`          | `optional` Sweep axis: 0 = X, 1 = Y, 2 = Z.              |
| loop      | `LoopOnce` / `LoopRepeat` / `LoopPingPong` | `LoopRepeat` | `optional` Animation loop type.                          |

## Methods

| Name        | Parameters                              | Description                                            |
| ----------- | --------------------------------------- | ------------------------------------------------------ |
| constructor | (target: THREE.Object3D, options?)      | Create a sweep light on a mesh, group or scene object. |
| play        | () => void                              | Play or resume the animation.                          |
| pause       | () => void                              | Pause the animation at the current frame.              |
| stop        | () => void                              | Stop the animation and reset it to the initial state.  |
| dispose     | () => void                              | Dispose the sweep meshes and the shared material.      |

## Class usage

```ts
import { SweepLight } from 'three-vue3'

const sweep = new SweepLight(model, { color: 0x00ffff, speed: 0.5 })
scene.add(model)

// The sweep runs from its own animation loop; on teardown:
sweep.dispose()
```
