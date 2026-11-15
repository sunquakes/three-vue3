<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Picker } from 'three-vue3'

const COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xe57373, 0xba68c8, 0x4db6ac]
const POSITIONS: Array<[number, number, number]> = [
  [-3, 0, 0],
  [-1.8, 0, 0],
  [-0.6, 0, 0],
  [0.6, 0, 0],
  [1.8, 0, 0],
  [3, 0, 0]
]

let picker: Picker | undefined
let hovered: THREE.Mesh | null = null

const created = (scene, { camera, renderer }) => {
  camera.position.set(0, 1, 6)
  camera.lookAt(0, 0, 0)

  POSITIONS.forEach((position, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: COLORS[index] })
    )
    mesh.position.set(...position)
    scene.add(mesh)
  })

  picker = new Picker(scene, camera, renderer.domElement)

  picker.on('hover', (event) => {
    if (hovered) {
      ;(hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
      hovered = null
    }
    if (event) {
      hovered = event.object as THREE.Mesh
      ;(hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x444444)
    }
    renderer.domElement.style.cursor = event ? 'pointer' : ''
  })

  picker.on('click', (event) => {
    if (!event) return
    const material = (event.object as THREE.Mesh).material as THREE.MeshStandardMaterial
    material.color.setHex(Math.floor(Math.random() * 0xffffff))
  })
}

onBeforeUnmount(() => {
  picker?.dispose()
  picker = undefined
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
