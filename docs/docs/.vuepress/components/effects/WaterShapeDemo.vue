<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water :shape="LAKE_OUTLINE" :segments="160" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Irregular lake shoreline in world units on the XZ plane, around the origin.
const LAKE_OUTLINE: [number, number][] = [
  [-8, -2.5],
  [-4.5, -5.5],
  [1.5, -6],
  [6.5, -3.5],
  [8, 1],
  [4.5, 5],
  [-1.5, 5.5],
  [-6.5, 3]
]

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  if (!camera) return
  camera.position.set(0, 6, 15)
  if (controls) controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
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
