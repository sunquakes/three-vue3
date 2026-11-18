<template>
  <div>
    <tv-scene class="scene" @created="created"></tv-scene>
    <label class="control">
      Sun elevation
      <input v-model.number="elevation" type="range" min="-5" max="70" step="1" />
    </label>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { SkyDome, globalParameterBus } from 'three-vue3'

const elevation = ref(18)

let dome: SkyDome | undefined

const sunDirection = (degrees: number) => {
  const phi = THREE.MathUtils.degToRad(degrees)
  return new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0.6).normalize()
}

const created = (scene, { camera }) => {
  camera.position.set(0, 2, 8)

  // No sunDirection is passed, so the dome follows the global parameter bus.
  dome = new SkyDome({ radius: 60 })
  scene.add(dome)

  globalParameterBus.set('sunDirection', sunDirection(elevation.value))
}

watch(elevation, (value) => {
  globalParameterBus.set('sunDirection', sunDirection(value))
})

onBeforeUnmount(() => {
  dome?.dispose()
  globalParameterBus.reset()
})
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 14px;
}
</style>
