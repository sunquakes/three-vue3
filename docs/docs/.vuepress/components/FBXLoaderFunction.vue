<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FBXLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await FBXLoader('/models/perseverance.fbx')
  model.scale.set(0.5, 0.5, 0.5)
  scene.add(model)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
