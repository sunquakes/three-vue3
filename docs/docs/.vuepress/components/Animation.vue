<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, Animation } from 'three-vue3'

let animation: Animation | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.8, 4)

  // Load the animated model and play every clip.
  const model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.position.set(0, 0, 0)
  scene.add(model)

  animation = new Animation(model)
  animation.playAll()
}

// The animation runs its own frame loop; stop it when the scene is torn down.
onBeforeUnmount(() => {
  animation?.dispose()
  animation = undefined
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
