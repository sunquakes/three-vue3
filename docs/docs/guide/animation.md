---
lang: en-US
title: Animation
---

::: tip type
Class
:::

## Default Usage

<Animation />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="#FAEBD7" @created="created"></tv-scene>
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

:::

## Methods

| Name                 | Parameters                                                                                    | Description                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| constructor          | (mesh: THREE.Mesh) => void                                                                    | `mesh` is the mesh containing the animation.                                                                                                                     |
| set                  | (index: number) => this                                                                       | `index` is the index of the animation to play. The default is 0.                                                                                                 |
| setByName            | (name: string) => this                                                                        | `name` is the name of the animation to play.                                                                                                                     |
| setLoop              | (loop: typeof THREE.LoopOnce \| typeof THREE.LoopRepeat \| typeof THREE.LoopPingPong) => this | `loop` is the loop mode. The default is LoopRepeat.                                                                                                              |
| setTimeScale         | (timeScale: number) => this                                                                   | `timeScale` is the time scale of the animation.                                                                                                                  |
| setClampWhenFinished | (clampWhenFinished: boolean) => this                                                          | `clampWhenFinished` is the clamp when finished of the animation.                                                                                                 |
| play                 | () => void                                                                                    | Play the animation. Default is the first animation of the mesh contained. If you want to play a specific animation, you need to call `set` or `setByName` first. |
| playAll              | () => void                                                                                    | Play all animations of the mesh contained.                                                                                                                       |
| stop                 | () => void                                                                                    | Stop the animation. Only stop the animation using `play` method played.                                                                                          |
| stopAll              | () => void                                                                                    | Stop all animations using `playAll` method played.                                                                                                               |
| pause                | () => void                                                                                    | Pause the animation. Only pause the animation using `play` method played.                                                                                        |
| pauseAll             | () => void                                                                                    | Pause all animations using `playAll` method played.                                                                                                              |
