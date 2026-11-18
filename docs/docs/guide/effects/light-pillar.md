---
lang: en-US
title: Light Pillar
---

::: tip type
Class
:::

A conical light pillar built from a translucent outer cone, a brighter inner core, a breathing glow at the tip and two pulse rings diffusing on the ground. It is commonly used as a data marker: map a normalized value to the `height` option so taller pillars mean larger values. The breathing glow and the pulse rings run from the pillar's own animation loop.

## Default Usage

<LightPillarDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { LightPillar } from 'three-vue3'

const pillars: LightPillar[] = []

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 2.4, 6)
  camera.lookAt(0, 1, 0)

  const data: Array<{ x: number; z: number; value: number; color: number }> = [
    { x: -2.2, z: 0, value: 0.35, color: 0x00ffff },
    { x: 0, z: -0.6, value: 1, color: 0x36e0a0 },
    { x: 2.2, z: 0, value: 0.62, color: 0xffb347 }
  ]

  data.forEach(({ x, z, value, color }) => {
    const pillar = new LightPillar({
      color,
      // Map a normalized data value to the pillar height
      height: 1 + value * 2.4,
      radius: 0.22
    })
    pillar.position.set(x, 0, z)
    scene.add(pillar)
    pillars.push(pillar)
  })
}

onBeforeUnmount(() => {
  pillars.forEach((pillar) => pillar.dispose())
  pillars.length = 0
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

| Name       | Type    | Default    | Description                                                  |
| ---------- | ------- | ---------- | ------------------------------------------------------------ |
| color      | number  | `0x00ffff` | `optional` Pillar color.                                     |
| height     | number  | `3`        | `optional` Pillar height along the Y axis, the base sits on `y = 0`. |
| radius     | number  | `0.3`      | `optional` Radius of the cone base.                          |
| opacity    | number  | `1`        | `optional` Global opacity multiplier (0-1).                  |
| speed      | number  | `1`        | `optional` Animation speed multiplier.                       |
| segments   | number  | `32`       | `optional` Radial segment count of the cones and rings.      |
| glow       | boolean | `true`     | `optional` Render the breathing glow at the top of the pillar. |
| ring       | boolean | `true`     | `optional` Render the two diffusing pulse rings at the base.  |
| ringRadius | number  | `radius * 3` | `optional` Outer radius the pulse rings expand to.         |

## Methods

| Name        | Parameters                  | Description                                                                                 |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| constructor | (options?: LightPillarOptions) | Create a light pillar. It extends `THREE.Group`, so add it to the scene and move it with `position`. |
| dispose     | () => void                  | Dispose the pillar and remove it from the scene.                                            |

## Class usage

```ts
import { LightPillar } from 'three-vue3'

const pillar = new LightPillar({ color: 0x36e0a0, height: 3, radius: 0.22 })
pillar.position.set(0, 0, 0)
scene.add(pillar)

// The glow and rings run from the pillar's own animation loop; on teardown:
pillar.dispose()
```
