<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { OBJLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await OBJLoader('/models/obj/perseverance.obj', '/models/obj/perseverance.mtl')
  model.scale.set(0.8, 0.8, 0.8)
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
