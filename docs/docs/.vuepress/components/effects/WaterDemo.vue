<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-water />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.58, 0.1, -0.81))
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
