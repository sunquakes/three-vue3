<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh, AxisType } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-2.5, 0, 0),
  new THREE.Vector3(-2, 0.4, 0),
  new THREE.Vector3(-1.5, 0.7, 0),
  new THREE.Vector3(-1, 0.9, 0),
  new THREE.Vector3(-0.5, 1, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.5, 1, 0),
  new THREE.Vector3(1, 0.9, 0),
  new THREE.Vector3(1.5, 0.7, 0),
  new THREE.Vector3(2, 0.4, 0),
  new THREE.Vector3(2.5, 0, 0)
]
const mesh = new FlowLineMesh({
  points,
  color: [0.0, 1.0, 1.0, 1],
  speed: 2,
  width: 0.4,
  axis: AxisType.Z,
  textureRepeat: 10
})
const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // Add mesh to scene.
  scene.add(mesh)
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
