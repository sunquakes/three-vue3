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
