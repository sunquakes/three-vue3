<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { ForceShield } from 'three-vue3'

let effect: ForceShield | undefined
let timer: ReturnType<typeof setInterval> | undefined
let removeListener: (() => void) | undefined

const created = (scene, { camera, controls }) => {
  if (!camera || !controls) return

  camera.position.set(0, 0.8, 4.6)
  camera.lookAt(0, 0, 0)

  effect = new ForceShield({ radius: 1.8, hitDamage: 3 })
  scene.add(effect)

  // Clicking the field fires an impact where the ray hits it.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const handlePointerDown = (event: PointerEvent) => {
    const canvas = controls.domElement
    const rect = canvas.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(pointer, camera)
    effect?.hit(raycaster.intersectObject(effect)[0]?.point)
  }

  controls.domElement.addEventListener('pointerdown', handlePointerDown)
  removeListener = () => {
    controls.domElement.removeEventListener('pointerdown', handlePointerDown)
  }

  // Automatic impacts keep the demo moving; the shield resets once depleted.
  timer = window.setInterval(() => {
    if (!effect) return
    effect.hit()
    if (effect.life < 0.6) effect.life = 1
  }, 1400)
}

onBeforeUnmount(() => {
  removeListener?.()
  removeListener = undefined
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
  effect?.dispose()
  effect = undefined
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
