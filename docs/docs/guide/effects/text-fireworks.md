---
lang: en-US
title: Text Fireworks
---

::: tip type
Class
:::

`TextFireworks` samples a line of text into glyph particles and turns it into a firework. On `launch()` the glyph flies apart into groups of colored bursts, then every particle is pulled back to the pixel it came from, leaving the readable text on screen again. Each particle is a camera-facing quad sized in CSS pixels, so the effect keeps its look at any distance.

The text is rasterized on an offscreen canvas and sampled on a fixed grid; `worldScale` converts the sampled pixels into world units. The class advances its own timeline, so `update(delta)` is optional.

## Default Usage

<TextFireworksDemo />

::: details Click me to view the codes

```vue
<template>
  <div>
    <div class="toolbar">
      <input v-model="text" class="input" placeholder="Type a sentence" @keyup.enter="launch" />
      <button type="button" class="button" @click="launch">Launch</button>
    </div>
    <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue'
import { TextFireworks } from 'three-vue3'

const DEFAULT_TEXT = 'Good things are coming'

const text = ref(DEFAULT_TEXT)
let effect: TextFireworks | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 1, 6)
  camera.lookAt(0, 1, 0)

  effect = new TextFireworks({ text: DEFAULT_TEXT })
  scene.add(effect)
}

const launch = () => {
  if (!effect) return
  // Sampling a new sentence rebuilds the particles, then replay the cycle.
  effect.setText(text.value)
  effect.launch()
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
.toolbar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.button {
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--vp-c-white);
  background: var(--vp-c-brand-1);
  border: none;
}
</style>
```

:::

## Options

| Name          | Type                | Default                                 | Description                                                                         |
| ------------- | ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| text          | string              | `'Good things are coming'`              | `optional` Text sampled into particles.                                             |
| colors        | ColorRepresentation[] | `['#ff8a3d', '#ffd166', '#4aa8ff', '#b06cff']` | `optional` Burst colors from left to right.                                |
| burstCenters  | [number, number][]  | four staggered positions                | `optional` Burst center of each group in world units.                               |
| burstScale    | number              | `1`                                     | `optional` Uniform scale applied to burst centers and radial spread.                |
| groupDelay    | number              | `0.22`                                  | `optional` Seconds between the launches of successive groups.                       |
| groupJitter   | number              | `0.2`                                   | `optional` Extra per-particle delay jitter in seconds.                              |
| pointSize     | number              | `3.4`                                   | `optional` Particle size in CSS pixels.                                             |
| trailOffset   | number              | `0.105`                                 | `optional` Seconds the trail layer lags behind the main layer.                      |
| trailOpacity  | number              | `0.34`                                  | `optional` Opacity multiplier of the trail layer.                                   |
| restColor     | ColorRepresentation | `0xffd4ad`                              | `optional` Color the letters rest at and fade back to.                              |
| worldScale    | number              | `0.0068`                                | `optional` World units per sampled canvas pixel.                                    |
| offsetY       | number              | `0.55`                                  | `optional` Vertical offset of the text center in world units.                       |
| autoPlay      | boolean             | `true`                                  | `optional` Play once automatically after the object is created.                     |
| autoPlayDelay | number              | `1.2`                                   | `optional` Seconds before the automatic launch, counted down by `update(delta)`.    |
| seed          | number              | `1`                                     | `optional` Seed for the deterministic per-particle randomness.                      |

## Members

| Name          | Type   | Description                                                       |
| ------------- | ------ | ----------------------------------------------------------------- |
| points        | Mesh   | Main particle layer.                                              |
| trail         | Mesh   | Delayed, dimmer copy of the same particles used as a trail.       |
| text          | string | Text currently sampled into the particle cloud.                   |
| particleCount | number | Number of glyph particles, each rendered as a billboarded quad.   |
| duration      | number | Length of one lift-off / burst / return cycle in seconds.          |
| phase         | number | Current position on the timeline in seconds.                      |
| playing       | boolean| Whether the timeline is currently advancing.                      |

## Methods

| Name               | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| update(delta)      | Optional: advance the timeline manually; the class also runs its own clock.  |
| launch()           | Restart the lift-off / burst / return cycle from `0`.                        |
| setText(text)      | Re-sample new text and settle back at rest.                                  |
| dispose()          | Dispose the geometry and both materials, then remove the group from its parent. |

## Class usage

```ts
import { TextFireworks } from 'three-vue3'

const effect = new TextFireworks({ text: 'Good things are coming', autoPlay: false })
scene.add(effect)

// The effect animates itself. `update(delta)` is optional.

// Replay with the same text, or sample a new line:
effect.launch()
effect.setText('Hello')

// On teardown:
effect.dispose()
```
