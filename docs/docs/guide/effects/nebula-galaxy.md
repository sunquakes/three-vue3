---
lang: en-US
title: Nebula Galaxy
---

::: tip type
Class
:::

`NebulaGalaxy` builds a four-armed spiral galaxy out of additive billboard particles, a procedural haze plane and an expanding click wave. Every star spins at its own angular speed, so the arms shear and wind instead of turning like a rigid disc; the haze lags slightly behind the particles so the pattern never looks like a texture.

The galaxy owns its own interaction: drag to tilt the disc, wheel or pinch to zoom and click to send a light wave from the core along the arms. The pointer listeners are attached to the canvas the first time the galaxy is rendered, and removed again on `dispose()`.

The galaxy advances from its own animation loop — the spin, the idle rotation, the tilt and zoom smoothing, the palette blend and the click wave all advance without per-frame code. `update(delta)` stays public if you want to drive the clock manually.

## Default Usage

<NebulaGalaxyDemo />

::: details Click me to view the codes

```vue
<template>
  <div>
    <div class="toolbar">
      <button
        v-for="item in palettes"
        :key="item.value"
        type="button"
        class="palette"
        :class="{ active: palette === item.value }"
        @click="palette = item.value"
      >
        <span class="swatch" :style="{ background: item.swatch }"></span>
        {{ item.label }}
      </button>
      <label class="speed">
        Speed
        <input v-model.number="speed" type="range" min="0" max="2" step="0.1" />
      </label>
      <button type="button" class="pause" @click="paused = !paused">
        {{ paused ? 'Resume' : 'Pause' }}
      </button>
    </div>
    <p class="hint">Drag to tilt the disc, scroll or pinch to zoom, click for a light wave.</p>
    <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { NebulaGalaxy } from 'three-vue3'
import type { GalaxyPalette } from 'three-vue3'

const palettes: Array<{ value: GalaxyPalette; label: string; swatch: string }> = [
  {
    value: 'violet-gold',
    label: 'Violet gold',
    swatch: 'linear-gradient(135deg, #ffe0a8, #b07cff 55%, #4a7dff)'
  },
  {
    value: 'aurora',
    label: 'Aurora',
    swatch: 'linear-gradient(135deg, #d6fff2, #35e0a8 55%, #4f8bff)'
  },
  {
    value: 'warm-flame',
    label: 'Warm flame',
    swatch: 'linear-gradient(135deg, #fff0c0, #ff9448 55%, #ff4d6d)'
  }
]

const palette = ref<GalaxyPalette>('violet-gold')
const speed = ref(1)
const paused = ref(false)

let effect: NebulaGalaxy | undefined

const created = (scene, { camera, controls, gridHelper }) => {
  camera.position.set(0, 2.6, 11)
  camera.lookAt(0, 0, 0)

  // The galaxy owns the pointer, so the orbit controls stay out of the way.
  if (controls) controls.enabled = false
  if (gridHelper && typeof gridHelper !== 'boolean') gridHelper.visible = false

  effect = new NebulaGalaxy({ palette: palette.value, speed: speed.value })
  scene.add(effect)
}

watch(palette, (value) => effect?.setPalette(value))
watch(speed, (value) => effect?.setSpeed(value))
watch(paused, (value) => effect?.setPaused(value))

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
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.palette,
.pause {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
  cursor: pointer;
  color: inherit;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
}
.palette.active {
  border-color: var(--vp-c-brand-1);
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.speed {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.speed input {
  width: 90px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  opacity: 0.6;
}
</style>
```

:::

## Options

| Name            | Type         | Default        | Description                                                          |
| --------------- | ------------ | -------------- | -------------------------------------------------------------------- |
| arms            | number       | `4`            | `optional` Number of spiral arms.                                    |
| armStars        | number       | `26000`        | `optional` Stars that trace the spiral arms.                         |
| coreStars       | number       | `4800`         | `optional` Stars that fill the core.                                 |
| dustStars       | number       | `4400`         | `optional` Large, faint stars that soften the edges.                 |
| backgroundStars | number       | `780`          | `optional` Distant background stars outside the galaxy body.         |
| radius          | number       | `5.15`         | `optional` Galaxy radius in world units.                             |
| armTightness    | number       | `1.12`         | `optional` How tightly the arms wind with distance.                  |
| palette         | GalaxyPalette | `'violet-gold'` | `optional` Colour scheme.                                           |
| speed           | number       | `1`            | `optional` Spin speed multiplier.                                    |
| autoRotate      | boolean      | `true`         | `optional` Slowly turn the galaxy when idle (off with reduced motion). |
| interaction     | boolean      | `true`         | `optional` Enable drag / wheel / pinch interaction on the canvas.    |
| pulse           | boolean      | `true`         | `optional` Click / tap wave (off with reduced motion).               |
| hazeOpacity     | number       | `0.95`         | `optional` Opacity of the haze layer.                                |
| followSpeed     | number       | `5.8`          | `optional` Smoothing speed of tilt, zoom and palette transitions.    |
| maxTiltX        | number       | `1.15`         | `optional` Maximum vertical tilt in radians.                         |
| maxTiltY        | number       | `1.25`         | `optional` Maximum horizontal tilt in radians.                       |
| minZoom         | number       | `0.62`         | `optional` Smallest zoom factor.                                     |
| maxZoom         | number       | `1.55`         | `optional` Largest zoom factor.                                      |
| seed            | number       | `7`            | `optional` Seed for the deterministic star distribution.             |

## Class usage

```ts
import { NebulaGalaxy } from 'three-vue3'

const galaxy = new NebulaGalaxy({ palette: 'violet-gold' })
scene.add(galaxy)

// The galaxy animates itself. Call update(delta) only to drive it manually:
galaxy.update(delta)

// Change the palette, pause the spin or send a light wave:
galaxy.setPalette('aurora')
galaxy.setPaused(true)
galaxy.pulse()

// On teardown:
galaxy.dispose()
```
