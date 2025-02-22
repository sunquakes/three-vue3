<template>
  <tv-scene class="scene" @created="created">
    <tv-obj-loader v-model="objUrl" :mtl="mtlUrl"></tv-obj-loader>
  </tv-scene>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const objUrl = ref('/models/obj/girl.obj')
const mtlUrl = ref('/models/obj/girl.mtl')

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
