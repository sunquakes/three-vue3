<template>
  <tv-scene
    class="scene"
    bg-color="#98F5F9"
    :grid-helper="false"
    @created="created"
  ></tv-scene>
</template>

<script lang="ts" setup>
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
}
</style>
