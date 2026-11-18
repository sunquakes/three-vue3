<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-obj-loader v-model="objUrl" :mtl="mtlUrl" :scale="[0.8, 0.8, 0.8]"></tv-obj-loader>
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
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}
</style>
