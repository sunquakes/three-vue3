<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh, AxisType } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-3, 0, 0),
  new THREE.Vector3(-2.7, 0.25, 0),
  new THREE.Vector3(-2.4, 0.48, 0),
  new THREE.Vector3(-2.1, 0.68, 0),
  new THREE.Vector3(-1.8, 0.85, 0),
  new THREE.Vector3(-1.5, 0.98, 0),
  new THREE.Vector3(-1.2, 1.05, 0),
  new THREE.Vector3(-0.9, 1.08, 0),
  new THREE.Vector3(-0.6, 1.05, 0),
  new THREE.Vector3(-0.3, 0.98, 0),
  new THREE.Vector3(0, 0.85, 0),
  new THREE.Vector3(0.3, 0.68, 0),
  new THREE.Vector3(0.6, 0.48, 0),
  new THREE.Vector3(0.9, 0.25, 0),
  new THREE.Vector3(1.2, 0, 0),
  new THREE.Vector3(1.5, -0.25, 0),
  new THREE.Vector3(1.8, -0.48, 0),
  new THREE.Vector3(2.1, -0.68, 0),
  new THREE.Vector3(2.4, -0.85, 0),
  new THREE.Vector3(2.7, -0.98, 0),
  new THREE.Vector3(3, -1.05, 0)
]
const mesh = new FlowLineMesh({ 
  points,
  width: 0.3,
  axis: AxisType.Z,
  textureRepeat: 8,
  color: [0.0, 1.0, 1.0, 1]
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
