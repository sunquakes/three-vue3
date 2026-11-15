<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { ME, GLTFLoader } from 'three-vue3'

let element: ME | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // Create movable element.
  element = new ME(model, [0, 0, -1])

  // Move to [0, 0, 0] from [0, 0, -1] in 10 seconds.
  element.moveTo([0, 0, 0], 10000)
}

// The movable element drives its own frame loop; stop it before the scene goes away.
onBeforeUnmount(() => {
  element?.dispose()
  element = undefined
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
