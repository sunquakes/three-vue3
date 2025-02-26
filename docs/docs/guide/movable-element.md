---
lang: en-US
title: Movable Element
---

::: tip type
Class
:::

## Default Usage

<MovableElement />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { ME, GLTFLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Load model to scene.
  const model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // Create movable element.
  const element = new ME(model, [0, 0, -1])

  // Move to [0, 0, 0] from [0, 0, -1] in 10 seconds.
  element.moveTo([0, 0, 0], 10000)
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

## Props

| Name  | Type        | Description                          |
| ----- | ----------- | ------------------------------------ |
| scene | THREE.Group | The model to be displayed and moved. |

## Methods

| Name        | Parameters                                                       | Description |
| ----------- | ---------------------------------------------------------------- | ----------- |
| constructor | (model: THREE.Group, position: [number, number, number]) => void |             |
