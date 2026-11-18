---
lang: en-US
title: Signal Wave
---

::: tip type
Class
:::

`SignalWave` renders a broadcast ping. A billboarded quad paints one soft-edged arc in the fragment shader; grow the mesh scale while `life` runs from 0 to 1 and each pulse reads as a signal that spreads outwards and dies away.

In automatic mode, pass `travel` and the wave animates itself along `bearing` from `origin` on its own clock — position, scale, billboard and `life` are all driven by the same clock. `count` adds staggered pulses as children, so one object renders a whole stream of pings.

Omit `travel` for manual mode: position, scale and billboard the quad yourself, then drive `life` yourself and aim the arc with `setDirection()` and `faceCamera()`.

## Default Usage

<SignalWaveDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { SignalWave } from 'three-vue3'

let effect: SignalWave | undefined

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 3.2, 11)
  camera.lookAt(0, 5, 0)

  // `travel` makes the pulses climb the bearing on their own and `count`
  // spreads six of them out in phase; no animation loop required.
  effect = new SignalWave({
    bearing: [0.24, 1, 0],
    travel: 26,
    period: 26 / 7,
    count: 6,
    startScale: 0.45,
    endScale: 3.4
  })
  scene.add(effect)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
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

| Name       | Type             | Default     | Description                                                                                  |
| ---------- | ---------------- | ----------- | -------------------------------------------------------------------------------------------- |
| innerColor | number           | `0x2985ff`  | `optional` Color of the arc where it is faint.                                               |
| outerColor | number           | `0xbdeaff`  | `optional` Color of the arc where it is dense.                                               |
| direction  | [number, number] | `[1, 0]`    | `optional` In-plane bearing the arc opens towards.                                           |
| life       | number           | `0`         | `optional` Initial life in the 0-1 range.                                                    |
| bearing    | [number, number, number] | `[0, 1, 0]` | `optional` World-space bearing the pulse travels and the arc opens along. Automatic mode. |
| origin     | [number, number, number] | `[0, 0, 0]` | `optional` Start point of the travel in world space.                                  |
| travel     | number           | —           | `optional` World distance covered in one cycle. When set, the wave animates itself.           |
| period     | number           | `2.4`       | `optional` Seconds per cycle in automatic mode.                                              |
| phase      | number           | `0`         | `optional` Phase offset in the 0-1 range used to stagger pulses.                             |
| count      | number           | `1`         | `optional` Number of staggered pulses created as children.                                   |
| startScale | number           | `0.45`      | `optional` Scale at the start of a cycle.                                                    |
| endScale   | number           | `3.4`       | `optional` Scale at the end of a cycle.                                                      |

## Class usage

```ts
import { SignalWave } from 'three-vue3'

const signal = new SignalWave({
  travel: 26,
  period: 26 / 7,
  count: 6,
  bearing: [0.24, 1, 0]
})
scene.add(signal)

// The pulse travels on its own; dispose it on teardown:
signal.dispose()
```
