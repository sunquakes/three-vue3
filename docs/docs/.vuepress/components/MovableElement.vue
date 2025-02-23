<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { ME, GLTFLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.5, 0.5, 0.5)
  scene.add(model)

  // Create movable element.
  const element = new ME(model, [0, 0, -1])

  // Move to [0, 0, 0] from [0, 0, -1] in 10 seconds.
  element.moveTo([0, 0, 0], 10000)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>