<template>
  <div class="index-animation">
    <tv-scene class="scene" :axes-helper="false" @created="created"></tv-scene>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, Animation } from 'three-vue3'

let animation: Animation | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 2.1)
  camera.offsetLeft = 60

  // Load the animated model and play every clip.
  const model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.scale.set(0.7, 0.7, 0.7)
  model.position.set(0, -0.25, 0)
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
.index-animation {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 250px;
}

.index-animation .scene {
  width: 100%;
  height: 100%;
}
</style>
