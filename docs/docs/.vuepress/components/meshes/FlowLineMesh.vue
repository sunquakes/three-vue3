<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { FlowLineMesh, AxisType } from 'three-vue3'
import * as THREE from 'three'

let mesh: FlowLineMesh | undefined

// A semicircle from [-2, 0, 0] over the top to [2, 0, 0].
const points = Array.from({ length: 21 }, (_, index) => {
  const angle = Math.PI - (index * Math.PI) / 20
  return new THREE.Vector3(Math.cos(angle) * 2, Math.sin(angle) * 2, 0)
})

const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  mesh = new FlowLineMesh({
    points,
    width: 0.3,
    axis: AxisType.Z,
    textureRepeat: 8,
    color: [0, 1, 1, 1]
  })
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
