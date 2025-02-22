---
lang: en-US
title: Bloom
---

::: tip type
Component
:::

## Default Usage

<Bloom />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" @created="created">
    <tv-bloom :layer="1" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshLambertMaterial({ color: 0xff5500 })
  const cube0 = new THREE.Mesh(geometry, material)
  cube0.position.set(0.5, 0, 0)
  cube0.layers.set(0)
  // Load cube to scene.
  scene.add(cube0)

  const cube1 = new THREE.Mesh(geometry, material)
  cube1.position.set(-0.5, 0, 0)
  cube1.layers.set(1)
  // Load cube to scene.
  scene.add(cube1)
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

| Name      | Type   | Default | Description                                   |
| --------- | ------ | ------- | --------------------------------------------- |
| layer     | number | 0       | `optional` The layer of the bloom effect.     |
| strength  | number | 1       | `optional` The strength of the bloom effect.  |
| radius    | number | 0.5     | `optional` The radius of the bloom effect.    |
| threshold | number | 0.5     | `optional` The threshold of the bloom effect. |
