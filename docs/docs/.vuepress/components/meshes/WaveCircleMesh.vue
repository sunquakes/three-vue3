<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { WaveCircleMesh } from 'three-vue3'

let mesh: WaveCircleMesh | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 2, 0)

  // Add mesh to scene.
  mesh = new WaveCircleMesh()
  scene.add(mesh)
}

// The mesh animates in its own frame loop and listens for resizes.
onBeforeUnmount(() => {
  mesh?.dispose()
  mesh = undefined
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
