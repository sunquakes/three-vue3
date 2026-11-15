<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { LightGradient } from 'three-vue3'

let gradient: LightGradient | undefined
let mesh: THREE.Mesh | undefined

const created = (scene, { camera, light }) => {
  if (!camera || !light) return

  camera.position.set(0, 0, 4)
  camera.lookAt(0, 0, 0)

  // Add an orange cube to show the lighting effect.
  mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5, metalness: 0.5 })
  )
  mesh.position.y = 0.75
  scene.add(mesh)

  // Loop gradient animation.
  const loopGradient = () => {
    // Reset all lights in the group to base intensity before starting a new
    // gradient cycle. `light` is a Group (AmbientLight + DirectionalLight).
    light.traverse((child) => {
      if (child.isLight) child.intensity = 2
    })
    gradient?.dispose()
    gradient = new LightGradient(light, {
      intensity: 20,
      duration: 4000,
      onComplete: loopGradient
    })
  }

  loopGradient()
}

onBeforeUnmount(() => {
  gradient?.dispose()
  gradient = undefined
  if (mesh) {
    mesh.parent?.remove(mesh)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    mesh = undefined
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
