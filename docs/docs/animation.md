```vue:no-line-numbers
<template>
  <tv-scene class="scene" bg-color="#FAEBD7" @created="created" />
</template>

<script lang="ts" setup>
import { GLTFLoader, Animation } from 'three-vue3'

const created = async (scene, { camera }) => {
  scene.position.set(0, -0.5, 0)
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await GLTFLoader('/models/perseverance.glb')
  scene.add(model)

  // Play animation.
  const animation = new Animation(model)
  animation.playAll()
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```
