<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { RadarSweep } from 'three-vue3'

let effect: RadarSweep | undefined
let ground: THREE.Mesh | undefined

// Gentle dune ripples shared by the ground mesh and the radar band, so the
// pulse visibly rides the terrain instead of slicing through it.
function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.55) * 0.22 + Math.cos(z * 0.4) * 0.18
}

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 7, 10)
  camera.lookAt(0, 0, 0)

  // Displace the ground with the same sampler the sweep conforms to.
  const geometry = new THREE.PlaneGeometry(22, 22, 96, 96)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)))
  }
  geometry.computeVertexNormals()

  ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x4a3a33, roughness: 1 })
  )
  scene.add(ground)

  // `period` makes the sweep loop on its own; no animation loop required.
  effect = new RadarSweep({ radius: 8, heightAt: terrainHeight, period: 2.4 })
  scene.add(effect)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
  if (ground) {
    ground.parent?.remove(ground)
    ground.geometry.dispose()
    ;(ground.material as THREE.Material).dispose()
    ground = undefined
  }
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
