<template>
  <tv-scene class="scene" @created="created">
    <tv-gltf-loader v-model="gltfUrl" :scale="[0.5, 0.5, 0.5]"></tv-gltf-loader>
  </tv-scene>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const gltfUrl = ref('/models/perseverance.glb')

const created = (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
