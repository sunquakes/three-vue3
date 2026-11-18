---
lang: en-US
title: Fireworks
---

::: tip type
Class
:::

`Fireworks` is a GPU-animated fireworks shell. A single launch streak rises from the origin, then bursts into a spherical spray of gravity-bent ribbon trails whose heads glow and whose tails dissolve through value noise. The whole motion lives in a TSL node material, so one shell is a single draw call and it runs on both WebGPU and WebGL.

The shell advances its own clock, so `update(delta)` is optional — call it only if you want to drive the timeline yourself. Each ribbon is a camera-facing quad strip built from an icosahedron that is projected onto a sphere, so `detail` controls how many bursts the shell produces.

## Default Usage

<FireworksDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="#1a1a2e" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Fireworks } from 'three-vue3'

let effects: Fireworks[] = []

// A small scripted show: each shell differs in color, burst height, spread,
// screen position and phase lengths so the shells desynchronise and keep
// popping instead of firing in a single synchronized volley.
const shells = [
  { color: 0xffd4a0, height: 6.6, scale: 3.6, offset: [-3.6, 0, -1.5], launch: 1.25, burst: 1.9 },
  { color: 0xff6b6b, height: 7.4, scale: 3.2, offset: [3.2, 0, -0.8], launch: 1.5, burst: 2.2 },
  { color: 0x7ad7ff, height: 5.9, scale: 3.9, offset: [-1.4, 0, 1.6], launch: 1.7, burst: 1.6 },
  { color: 0xffe14d, height: 8.1, scale: 3.1, offset: [1.8, 0, -2.4], launch: 1.35, burst: 2.4 },
  { color: 0xb98bff, height: 6.9, scale: 3.5, offset: [-4.4, 0, 1.2], launch: 1.6, burst: 1.8 },
  { color: 0x66ffb2, height: 7.7, scale: 3.3, offset: [4.1, 0, 1.8], launch: 1.2, burst: 2.1 },
  { color: 0xffffff, height: 6.2, scale: 3.8, offset: [0.2, 0, 0.4], launch: 1.45, burst: 1.7 },
  { color: 0xff8ad4, height: 8.4, scale: 3.0, offset: [-2.6, 0, -2.8], launch: 1.75, burst: 2.3 },
  { color: 0xffa54d, height: 7.1, scale: 3.4, offset: [2.7, 0, 2.6], launch: 1.3, burst: 1.95 },
  { color: 0x8ab4ff, height: 6.8, scale: 3.7, offset: [-0.9, 0, -1.1], launch: 1.55, burst: 2.05 }
]

const created = (scene, { camera }) => {
  camera.position.set(0, 6, 17)
  camera.lookAt(0, 6, 0)

  effects = shells.map((shell) => {
    const fireworks = new Fireworks({
      color: shell.color,
      burstHeight: shell.height,
      burstScale: shell.scale,
      burstPositionOffset: new THREE.Vector3(shell.offset[0], shell.offset[1], shell.offset[2]),
      launchDuration: shell.launch,
      burstDuration: shell.burst,
      loop: true
    })
    scene.add(fireworks)
    return fireworks
  })
}

onBeforeUnmount(() => {
  for (const effect of effects) effect.dispose()
  effects = []
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

| Name                | Type                | Default       | Description                                                                                          |
| ------------------- | ------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| radius              | number              | `1`           | `optional` Burst trail target length radius, baked into the geometry.                                |
| detail              | number              | `0`           | `optional` Icosahedron subdivision level, baked into the geometry. More detail means more bursts.   |
| segments            | number              | `5`           | `optional` Number of segments sampled along each trail, baked into the geometry.                     |
| gravity             | number              | `1`           | `optional` Gravity parabola coefficient, baked into the geometry.                                    |
| width               | number              | `0.1`         | `optional` Ribbon half-width.                                                                        |
| startTime           | number              | `0`           | `optional` Animation start time in seconds.                                                          |
| launchDuration      | number              | `1.5`         | `optional` Launch phase duration in seconds.                                                         |
| delayDuration       | number              | `-0.4`        | `optional` Delay between launch and burst in seconds; may be negative to overlap the phases.         |
| burstDuration       | number              | `2`           | `optional` Burst phase duration in seconds.                                                          |
| burstHeight         | number              | `6.5`         | `optional` Burst height along the local Y axis.                                                      |
| burstScale          | number              | `3.5`         | `optional` Overall burst scale.                                                                      |
| burstPositionOffset | Vector3             | `(0, 0, 0)`   | `optional` Burst origin offset.                                                                      |
| loop                | boolean             | `true`        | `optional` Replay the effect when one cycle finishes.                                                |
| color               | ColorRepresentation | `'#ffd4a0'`   | `optional` Base ribbon color.                                                                        |
| bloomIntensity      | number              | `9`           | `optional` Head glow intensity.                                                                      |
| bloomFalloff        | number              | `18`          | `optional` Head glow length exponent; larger values tighten the glowing tip.                         |
| noiseFalloff        | number              | `3`           | `optional` Noise dissolve time exponent.                                                             |
| noiseScale          | Vector2             | `(10, 200)`   | `optional` Noise UV scale as `(across, along)`.                                                      |

## Class usage

```ts
import * as THREE from 'three'
import { Fireworks } from 'three-vue3'

const shell = new Fireworks({
  color: '#ffd166',
  burstHeight: 6.5,
  burstScale: 3.5,
  burstPositionOffset: new THREE.Vector3(0, 0, 0)
})
scene.add(shell)

// The shell animates itself. `update(delta)` is optional and only needed when
// you want to drive the timeline manually:

// Live tweaks, the uniforms are updated in place:
shell.width = 0.14
shell.burstScale = 4
shell.color = '#4aa8ff'

// Restart the current cycle:
shell.restart()

// On teardown:
shell.dispose()
```
