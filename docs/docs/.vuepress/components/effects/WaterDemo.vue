<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-water />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
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
