<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { SkyDome, globalParameterBus } from 'three-vue3'

let dome: SkyDome | undefined

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 0.8, 7)
  camera.lookAt(0, 0.8, 0)

  // One shared sun direction drives every effect in the scene.
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.78, 0.2, -0.6))

  dome = new SkyDome()
  scene.add(dome)
}

onBeforeUnmount(() => {
  dome?.dispose()
  dome = undefined
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
