<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh } from 'three-vue3'

const mesh = new WaveCircleMesh()
const created = (scene, { camera }) => {
  camera.position.set(0, 2, 0)

  // Add mesh to scene.
  scene.add(mesh)
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
