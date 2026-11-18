<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { WaveCircleMesh, AxisType } from 'three-vue3'

let mesh: WaveCircleMesh | undefined

const created = (scene, { camera }) => {
  camera.position.set(2, 0, 0)

  mesh = new WaveCircleMesh({
    radius: 0.5,
    color: [0.98, 0.61, 0.6, 1],
    speed: 2,
    verticalAxis: AxisType.X
  })
  scene.add(mesh)
  mesh.position.set(0, 0.5, 0)
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
