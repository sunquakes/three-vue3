---
lang: zh-CN
title: 泛光
---

::: tip type
Component
:::

`<tv-bloom>` 对指定相机层上的对象做泛光。它在 `WebGPURenderer`（默认）与经由 `WebGLNodesHandler` 的传统 `WebGLRenderer` 上都能渲染；给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

## 默认用法

<Bloom />

::: details 点击我查看代码

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

  // 左侧：位于 layer 1 的发光方块，会被泛光通道处理。
  const cube0 = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff5500 }))
  cube0.position.set(-0.5, 0, 0)
  cube0.layers.set(1)
  scene.add(cube0)

  // 右侧：同样的方块放在 layer 0，不参与泛光，用于对比。
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

## 属性

| 名称      | 类型   | 默认值 | 描述                  |
| --------- | ------ | ------ | --------------------- |
| layer     | number | 0      | `可选` 泛光所在的层。 |
| strength  | number | 1      | `可选` 泛光强度。     |
| radius    | number | 0.5    | `可选` 泛光半径。     |
| threshold | number | 0.5    | `可选` 泛光阈值。     |
