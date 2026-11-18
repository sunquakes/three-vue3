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
  if (!camera) return

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
