<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, ModelRotator } from 'three-vue3'
import type * as THREE from 'three'

let rotator: ModelRotator | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.position.set(0, 0, 0)
  scene.add(model)

  rotator = new ModelRotator(model, {
    axis: 'y',
    speed: 0.5,
    autoStart: true
  })
}

onBeforeUnmount(() => {
  rotator?.dispose()
  rotator = undefined
  if (model) {
    model.parent?.remove(model)
    model = undefined
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
