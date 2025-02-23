<template>
  <tv-scene class="scene" @created="created">
    <tv-obj-loader v-model="objUrl" :mtl="mtlUrl" :scale="[0.5, 0.5, 0.5]"></tv-obj-loader>
  </tv-scene>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const objUrl = ref('/models/obj/perseverance.obj')
const mtlUrl = ref('/models/obj/perseverance.mtl')

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
