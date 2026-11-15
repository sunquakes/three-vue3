---
lang: en-US
title: Radar Sweep
---

::: tip type
Class
:::

`RadarSweep` is a ground-radar pulse: a ring band rolls outwards from the mesh origin, broken up by drifting noise so the wavefront never reads as a drawn circle. It layers the leading crest, a weaker first echo trailing behind it, the faint already-swept footprint and short blips over buried features.

The band is displaced onto the ground once from the `heightAt` sampler, so it conforms to uneven terrain. Set the mesh position before adding it to the scene (the band is rebuilt on `added`), or call `rebuild()` after moving it.

Pass `period` to let the pulse loop on its own — the sweep advances from its internal clock. `update(delta)` is only needed when you want to drive the progress yourself.

## Default Usage

<RadarSweepDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { RadarSweep } from 'three-vue3'

let effect: RadarSweep | undefined
let ground: THREE.Mesh | undefined

// Gentle dune ripples shared by the ground mesh and the radar band, so the
// pulse visibly rides the terrain instead of slicing through it.
function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.55) * 0.22 + Math.cos(z * 0.4) * 0.18
}

const created = (scene, { camera }) => {
  camera.position.set(0, 7, 10)
  camera.lookAt(0, 0, 0)

  // Displace the ground with the same sampler the sweep conforms to.
  const geometry = new THREE.PlaneGeometry(22, 22, 96, 96)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)))
  }
  geometry.computeVertexNormals()

  ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x4a3a33, roughness: 1 })
  )
  scene.add(ground)

  // `period` makes the sweep loop on its own; no animation loop required.
  effect = new RadarSweep({ radius: 8, heightAt: terrainHeight, period: 2.4 })
  scene.add(effect)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
  if (ground) {
    ground.parent?.remove(ground)
    ground.geometry.dispose()
    ;(ground.material as THREE.Material).dispose()
    ground = undefined
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

| Name        | Type                                   | Default    | Description                                                                                       |
| ----------- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| radius      | number                                 | `8`        | `optional` Outer radius the pulse expands to.                                                     |
| segments    | number                                 | `128`      | `optional` Radial segment count of the ring.                                                      |
| rings       | number                                 | `20`       | `optional` Concentric segment count of the ring.                                                  |
| heightAt    | (x: number, z: number) => number       | —          | `optional` World-space ground sampler; displaces the band onto the terrain.                       |
| color       | number                                 | `0x57ccff` | `optional` Color of the sweeping bands.                                                           |
| crestColor  | number                                 | `0xa8f5ff` | `optional` Color of the leading crest.                                                            |
| echoDelay   | number                                 | `1.8`      | `optional` Distance the weaker first return trails behind the crest.                              |
| opacity     | number                                 | `0.9`      | `optional` Alpha multiplier of the whole pulse.                                                   |
| lift        | number                                 | `0.04`     | `optional` Height offset above the terrain.                                                       |
| progress    | number                                 | `0`        | `optional` Initial pulse progress in the 0-1 range.                                               |
| period      | number                                 | —          | `optional` Seconds per full sweep. When set, the pulse loops on its own.                           |

## Class usage

```ts
import { RadarSweep } from 'three-vue3'

const sweep = new RadarSweep({
  radius: 8,
  period: 2.4,
  heightAt: (x, z) => Math.sin(x * 0.5 + z * 0.3) * 0.2
})
sweep.position.set(0, 0, 0)
scene.add(sweep)

// The pulse animates itself when `period` is set.

// On teardown:
sweep.dispose()
```
