<template>
  <div>
    <div class="toolbar">
      <input v-model="text" class="input" placeholder="Type a sentence" />
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
  if (!camera) return

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
