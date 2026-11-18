<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-gltf-loader v-model="gltfUrl" :scale="[0.8, 0.8, 0.8]" draco></tv-gltf-loader>
  </tv-scene>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const gltfUrl = ref('/models/perseverance-draco.glb')

const created = (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)
}
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}
</style>
