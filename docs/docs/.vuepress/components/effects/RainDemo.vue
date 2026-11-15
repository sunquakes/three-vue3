<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-rain :count="3000" :speed="0.8" :color="0x87ceeb" :range="30" :height="20" />
  </tv-scene>
</template>

<script lang="ts" setup>
const created = (_scene, { camera }) => {
  if (!camera) return
  camera.position.set(0, 0, 4)
  camera.lookAt(0, 0, 0)
}
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
