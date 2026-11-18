<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  />
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import type { GeoPoint } from 'three-vue3'

// Tiananmen Square, Beijing (WGS84).
const ORIGIN: GeoPoint = { lng: 116.397, lat: 39.909 }

// Scene builds the city-scale grid and disposes it on unmount.
const GRID = { size: 1200, divisions: 24, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

const PLACES: { point: GeoPoint; color: number }[] = [
  { point: ORIGIN, color: 0xffd166 },
  { point: { lng: 116.4005, lat: 39.909 }, color: 0x4fc3f7 },
  { point: { lng: 116.397, lat: 39.9117 }, color: 0x81c784 },
  { point: { lng: 116.3935, lat: 39.9063 }, color: 0xe57373 }
]

const objects: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
let disposed = false

const created = (scene: THREE.Scene, { camera }: { camera: THREE.Camera }) => {
  if (disposed) return

  // A raised south-side viewpoint looks north over the landmarks.
  scene.setPosition(camera, { x: 0, y: 500, z: 700 })
  camera.lookAt(0, 0, 0)

  PLACES.forEach(({ point, color }) => {
    const radius = 35
    const geometry = new THREE.SphereGeometry(radius, 24, 16)
    const material = new THREE.MeshBasicMaterial({ color })
    const marker = new THREE.Mesh(geometry, material)
    scene.setPosition(marker, point)
    marker.position.y = radius
    scene.add(marker)
    objects.push(marker)
  })
}

onBeforeUnmount(() => {
  disposed = true
  objects.forEach((object) => {
    object.removeFromParent()
    object.geometry.dispose()
    object.material.dispose()
  })
  objects.length = 0
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
