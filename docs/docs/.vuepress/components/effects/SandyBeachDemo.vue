<template>
  <div class="beach">
    <tv-scene class="scene" bg-color="rgb(40, 42, 54)">
      <SandyBeach :preset="preset" :auto-walk="walking" :crouching="crouching" />
    </tv-scene>
    <div class="controls">
      <button
        v-for="item in presets"
        :key="item.value"
        type="button"
        class="pill"
        :class="{ active: preset === item.value }"
        @click="preset = item.value"
      >
        {{ item.label }}
      </button>
      <button type="button" class="pill" :class="{ active: walking }" @click="walking = !walking">
        Walk
      </button>
      <button
        type="button"
        class="pill"
        :class="{ active: crouching }"
        @click="crouching = !crouching"
      >
        Crouch
      </button>
      <button type="button" class="pill" @click="share">{{ shared ? 'Copied' : 'Share' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SandyBeach } from 'three-vue3'
import type { BeachPresetName } from 'three-vue3'

const presets: Array<{ value: BeachPresetName; label: string }> = [
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'morning', label: 'Morning' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'blueHour', label: 'Blue hour' },
  { value: 'night', label: 'Night' }
]

const preset = ref<BeachPresetName>('sunrise')
const walking = ref(false)
const crouching = ref(false)
const shared = ref(false)

let timer: number | undefined

const share = () => {
  const url = window.location.href
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => undefined)
  }
  shared.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    shared.value = false
  }, 1600)
}
</script>

<style>
.beach {
  position: relative;
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
.beach .scene {
  width: 100%;
  height: 100%;
}
.controls {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 24px);
  pointer-events: none;
}
.pill {
  padding: 4px 11px;
  font: 500 12px system-ui, -apple-system, sans-serif;
  color: #f5f5f5;
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(40, 40, 40, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition:
    background 160ms ease,
    border-color 160ms ease;
  pointer-events: auto;
}
.pill.active {
  border-color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.22);
}
</style>
