<template>
  <tv-scene class="scene" bg-color="rgb(8, 10, 20)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GlowSprite } from 'three-vue3'

interface DotConfig {
  position: [number, number, number]
  size: number
  color: number
  tint: number
  opacity: number
  /** Optional self-pulse: seconds per breathing cycle */
  pulsePeriod?: number
  /** Optional pulse phase offset in the 0-1 range */
  phase?: number
}

// A handful of glowing dots at different scales: the pale blue Earth and two
// fainter stars, one of them pulsing like a beacon — no animation loop needed.
const dots: DotConfig[] = [
  { position: [0, 1, 0], size: 3.2, color: 0x8ecbff, tint: 0xbcdfff, opacity: 0.9 },
  {
    position: [-3.4, -0.8, -2],
    size: 1.4,
    color: 0xffb066,
    tint: 0xffd9a8,
    opacity: 0.8,
    pulsePeriod: 2.2,
    phase: 0.3
  },
  { position: [3.6, 2.4, -4], size: 2.2, color: 0x9ce8ff, tint: 0xd8f4ff, opacity: 0.85 }
]

const sprites: GlowSprite[] = []

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 0.8, 7)
  camera.lookAt(0, 0.8, 0)

  dots.forEach((dot) => {
    const sprite = new GlowSprite({
      size: dot.size,
      color: dot.color,
      tint: dot.tint,
      opacity: dot.opacity,
      pulsePeriod: dot.pulsePeriod,
      phase: dot.phase
    })
    sprite.position.set(...dot.position)
    scene.add(sprite)
    sprites.push(sprite)
  })
}

onBeforeUnmount(() => {
  sprites.forEach((sprite) => sprite.dispose())
  sprites.length = 0
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
