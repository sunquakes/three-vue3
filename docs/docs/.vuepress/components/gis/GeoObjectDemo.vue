<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  >
    <GeoObject
      v-for="(marker, index) in MARKERS"
      :key="index"
      :coordinate="marker"
      datum="GCJ02"
      :object="anchors[index]"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

// Scene origin in WGS84; the anchored markers below are GCJ02 coordinates as
// returned by Chinese map services such as AMap or Tencent.
const ORIGIN: GeoPoint = { lng: 116.391, lat: 39.907 }

// City-scale grid options; Scene builds and disposes the GridHelper.
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

// GCJ02 ("Mars") coordinates near Tiananmen Square.
const MARKERS: GeoPoint[] = [
  { lng: 116.397428, lat: 39.90923 },
  { lng: 116.4005, lat: 39.9117 },
  { lng: 116.3945, lat: 39.912 }
]

// Anchors created in the scene `created` handler and handed to GeoObject, so
// the marker meshes are never built at module scope.
const anchors = shallowRef<THREE.Object3D[]>([])

const created = (scene: THREE.Scene, { camera }: { camera: THREE.PerspectiveCamera }) => {
  // A raised south-side viewpoint looks north over the markers; the scene
  // places the camera from local metres and it looks back at the origin.
  scene.setPosition(camera, { x: 0, y: 750, z: 1000 })
  camera.lookAt(0, 0, 0)

  anchors.value = MARKERS.map(() => {
    const anchor = new THREE.Group()
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(40, 120, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    )
    cone.position.y = 60
    anchor.add(cone)
    return anchor
  })
}

onBeforeUnmount(() => {
  // Externally supplied objects stay owned by the demo, so dispose them here.
  anchors.value.forEach((anchor) => {
    anchor.removeFromParent()
    anchor.traverse((child) => {
      const mesh = child as THREE.Mesh
      mesh.geometry?.dispose()
      ;(mesh.material as THREE.Material | undefined)?.dispose()
    })
  })
  anchors.value = []
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
