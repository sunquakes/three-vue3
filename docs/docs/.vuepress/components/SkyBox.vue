<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { SkyBox } from 'three-vue3'

const skyBox = new SkyBox([
  '/images/examples/skybox/right.jpg',
  '/images/examples/skybox/left.jpg',
  '/images/examples/skybox/top.jpg',
  '/images/examples/skybox/bottom.jpg',
  '/images/examples/skybox/front.jpg',
  '/images/examples/skybox/back.jpg'
])

const created = (scene) => {
  scene.background = skyBox.scene
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
