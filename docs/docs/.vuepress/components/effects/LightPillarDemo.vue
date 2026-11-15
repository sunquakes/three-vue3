<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { LightPillar } from 'three-vue3'

const pillars: LightPillar[] = []

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 2.4, 6)
  camera.lookAt(0, 1, 0)

  const data: Array<{ x: number; z: number; value: number; color: number }> = [
    { x: -2.2, z: 0, value: 0.35, color: 0x00ffff },
    { x: 0, z: -0.6, value: 1, color: 0x36e0a0 },
    { x: 2.2, z: 0, value: 0.62, color: 0xffb347 }
  ]

  data.forEach(({ x, z, value, color }) => {
    const pillar = new LightPillar({
      color,
      // Map a normalized data value to the pillar height
      height: 1 + value * 2.4,
      radius: 0.22
    })
    pillar.position.set(x, 0, z)
    scene.add(pillar)
    pillars.push(pillar)
  })
}

onBeforeUnmount(() => {
  pillars.forEach((pillar) => pillar.dispose())
  pillars.length = 0
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
