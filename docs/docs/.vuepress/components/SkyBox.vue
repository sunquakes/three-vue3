<template>
  <tv-scene class="scene" :grid-helper="false" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { SkyBox } from 'three-vue3'

let skyBox: SkyBox | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)

  skyBox = new SkyBox([
    '/images/examples/skybox/right.jpg',
    '/images/examples/skybox/left.jpg',
    '/images/examples/skybox/top.jpg',
    '/images/examples/skybox/bottom.jpg',
    '/images/examples/skybox/front.jpg',
    '/images/examples/skybox/back.jpg'
  ])
  scene.background = skyBox.scene
}

onBeforeUnmount(() => {
  skyBox?.scene.dispose()
  skyBox = undefined
})
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
