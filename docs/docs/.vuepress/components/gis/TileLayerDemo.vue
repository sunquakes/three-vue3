<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  >
    <TileLayer :url="TILE_URL" :zoom="TILE_ZOOM" datum="GCJ02" :subdomains="TILE_SUBDOMAINS" />
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

// AMap (Gaode) raster tiles are indexed in GCJ02 coordinates. Style 8 serves
// tiles through maxZoom=19; this demo streams them at zoom 17.
const TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
const TILE_SUBDOMAINS = ['1', '2', '3', '4']
const TILE_ZOOM = 17

// City-scale grid options; Scene builds and disposes the GridHelper.
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

// Anchor built in the scene `created` handler; GeoObject only positions and
// parents it, so the demo disposes it on unmount.
const pinAnchor = shallowRef<THREE.Object3D>()

const created = (scene: THREE.Scene, { camera }: { camera: THREE.PerspectiveCamera }) => {
  // A fixed south-side viewpoint keeps the raster map readable like a
  // conventional map; looking north from due south keeps it north-up. The
  // 45-degree depression keeps every frustum corner ray on the ground.
  scene.setPosition(camera, { x: 0, y: 450, z: 450 })
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
