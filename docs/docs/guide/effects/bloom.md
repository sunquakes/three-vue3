---
lang: en-US
title: Bloom
---

::: tip type
Component
:::

`<tv-bloom>` blooms the objects on the selected camera layer. It renders on `WebGPURenderer` (the default) and on a classic `WebGLRenderer` through `WebGLNodesHandler`; add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

## Default Usage

<Bloom />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-bloom :layer="1" :strength="2" :radius="1" :threshold="0" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'

const created = (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  const geometry = new THREE.BoxGeometry()

  // Left: glowing cube on layer 1, so the bloom pass picks it up.
  const cube0 = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff5500 }))
  cube0.position.set(-0.5, 0, 0)
  cube0.layers.set(1)
  scene.add(cube0)

  // Right: the same cube on layer 0, without bloom, for comparison.
  const cube1 = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff5500 }))
  cube1.position.set(0.5, 0, 0)
  cube1.layers.set(0)
  scene.add(cube1)
}
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Props

| Name      | Type   | Default | Description                                   |
| --------- | ------ | ------- | --------------------------------------------- |
| layer     | number | 0       | `optional` The layer of the bloom effect.     |
| strength  | number | 1       | `optional` The strength of the bloom effect.  |
| radius    | number | 0.5     | `optional` The radius of the bloom effect.    |
| threshold | number | 0.5     | `optional` The threshold of the bloom effect. |
