<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :grid-helper="gridHelper"
    @created="created"
  >
    <tv-height-fog />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

// Columns receding into the distance: [x, z, width, height].
const pillars: [number, number, number, number][] = [
  [-5, 5, 2.8, 13],
  [6, 2, 3.2, 17],
  [-2, -4, 2.6, 11],
  [8, -9, 3.4, 21],
  [-9, -15, 3.0, 15],
  [3, -22, 2.8, 19],
  [-6, -30, 3.4, 23]
]

const gridHelper = {
  size: 400,
  divisions: 40,
  colorGrid: 0x3a4050,
  colorCenterLine: 0x4d5570,
  y: 0.02
}

const meshes: THREE.Mesh[] = []

const created = (scene, { camera }) => {
  camera.position.set(0, 5, 14)
  camera.lookAt(0, 7, -12)

  // Same direction the old lightAzimuth 30° / lightElevation 25° produced.
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.453, 0.423, 0.785))

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x5c6579, roughness: 0.85 })
  const columns = pillars.map(([x, z, width, height]) => {
    const column = new THREE.Mesh(geometry, material)
    column.position.set(x, height / 2, z)
    column.scale.set(width, height, width)
    return column
  })

  meshes.push(ground, ...columns)
  scene.add(...meshes)
}

onBeforeUnmount(() => {
  meshes.forEach((mesh) => {
    mesh.parent?.remove(mesh)
    mesh.geometry.dispose()
    const meshMaterial = mesh.material as THREE.Material
    meshMaterial.dispose()
  })
  meshes.length = 0
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
