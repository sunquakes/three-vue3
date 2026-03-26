---
lang: zh-CN
title: 流动线网格
---

::: tip type
Class
:::

## 默认用法

<FlowLineMesh />

::: details 点击查看代码

```vue
<template>
  <tv-scene class="flow-line" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh, AxisType } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(-1.5, 0.3, 0),
  new THREE.Vector3(-1, 0.5, 0),
  new THREE.Vector3(-0.5, 0.6, 0),
  new THREE.Vector3(0, 0.6, 0),
  new THREE.Vector3(0.5, 0.6, 0),
  new THREE.Vector3(1, 0.5, 0),
  new THREE.Vector3(1.5, 0.3, 0),
  new THREE.Vector3(2, 0, 0)
]
const mesh = new FlowLineMesh({ 
  points,
  width: 0.3,
  axis: AxisType.Z,
  textureRepeat: 8,
  color: [0.0, 1.0, 1.0, 1]
})
const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // 添加网格到场景
  scene.add(mesh)
}
</script>

<style>
.flow-line {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## 自定义选项

<FlowLineMeshOptions />

::: details 点击查看代码

```vue
<template>
  <tv-scene class="flow-line" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FlowLineMesh } from 'three-vue3'
import * as THREE from 'three'

const points = [
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(2, 0, 0)
]
const mesh = new FlowLineMesh({
  points,
  color: [0.0, 1.0, 1.0, 1],
  speed: 2,
  width: 0.4,
  axis: AxisType.Z,
  textureRepeat: 10
})
const created = (scene, { camera }) => {
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)

  // 添加网格到场景
  scene.add(mesh)
}
</script>

<style>
.flow-line {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## 构造函数参数

| 参数    | 属性   | 类型                | 默认值                                       | 描述                                                                            |
| ------- | ------ | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| options | points | THREE.Vector3[]     | `[-1,0,0], [0,0.5,0], [1,0,0]`              | `可选` 定义线路径的所有 3D 坐标点数组。                                         |
|         | color  | [number, number, number, number] | [0.6, 0.96, 0.98, 1] | `可选` 流动线的颜色（RGBA）。                                                   |
|         | speed  | number              | 1                                            | `可选` 流动动画的速度。                                                         |
|         | width  | number              | 0.05                                         | `可选` 线的宽度。                                                               |
|         | axis   | AxisType            | AxisType.Z                                   | `可选` 线的朝向轴。`X`、`Y` 或 `Z`。                                            |
