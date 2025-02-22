<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh, AxisType } from 'three-vue3'

const mesh = new WaveCircleMesh({
  radius: 0.5,
  color: [0.98, 0.61, 0.6, 1],
  speed: 2,
  verticalAxis: AxisType.X
})
const created = (scene, { camera }) => {
  camera.position.set(2, 0, 0)

  // Add mesh to scene.
  scene.add(mesh)
  mesh.position.set(...[0, 0.5, 0])
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
