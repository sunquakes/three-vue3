<template>
  <tv-scene class="scene" :camera="camera" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { FitCamera } from 'three-vue3'

const camera = new FitCamera(45, 1, 0.1, 2000)

const created = (scene, { controls }) => {
  const group = new THREE.Group()
  const geometry = new THREE.SphereGeometry(0.4, 16, 16)
  const material = new THREE.MeshLambertMaterial({ color: 0xff7a45 })

  for (let i = 0; i < 12; i++) {
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(Math.cos(i) * 6, (i % 3) - 1, Math.sin(i) * 6)
    group.add(sphere)
  }

  scene.add(group)

  // Frame the whole group in a single call.
  if (controls) camera.bind(controls).fitToObject(group)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
