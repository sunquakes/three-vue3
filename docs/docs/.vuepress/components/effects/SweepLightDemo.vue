<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, SweepLight } from 'three-vue3'
import type * as THREE from 'three'

let effect: SweepLight | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // The sweep is drawn over the model's surface.
  effect = new SweepLight(model)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
  if (model) {
    model.parent?.remove(model)
    model = undefined
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
