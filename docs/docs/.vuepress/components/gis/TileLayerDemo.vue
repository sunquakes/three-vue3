<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="false"
    @created="created"
  >
    <TileLayer :url="TILE_URL" :zoom="TILE_ZOOM" datum="WGS84" />
    <GeoObject :coordinate="PIN" datum="WGS84" :object="pinAnchor" />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject, TileLayer } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

// WGS84 (GPS standard) point near Suzhou; used as both the local origin and
// the pin anchor.
const PIN: GeoPoint = { lng: 120.60682, lat: 31.330898 }
const ORIGIN = PIN

// OpenStreetMap standard raster tiles are indexed in WGS84 coordinates.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ZOOM = 15

// Anchor built in the scene `created` handler; GeoObject only positions and
// parents it, so the demo disposes it on unmount.
const pinAnchor = shallowRef<THREE.Object3D>()

const created = (scene: THREE.Scene, { camera }: { camera: THREE.PerspectiveCamera }) => {
  // A fixed south-side viewpoint keeps the raster map readable like a
  // conventional map; looking north from due south keeps it north-up.
  scene.setPosition(camera, { x: 0, y: 600, z: 850 })
  camera.lookAt(0, 0, 0)

  const anchor = new THREE.Group()
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(40, 120, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
  )
  // Lift the cone so its base sits on the ground.
  cone.position.y = 60
  anchor.add(cone)
  pinAnchor.value = anchor
}

onBeforeUnmount(() => {
  const anchor = pinAnchor.value
  if (!anchor) return
  anchor.removeFromParent()
  anchor.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    ;(mesh.material as THREE.Material | undefined)?.dispose()
  })
  pinAnchor.value = undefined
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
