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
