---
lang: zh-CN
title: 波动圆
---

::: tip type
Class
:::

## 默认用法

<WaveCircleMesh />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh } from 'three-vue3'

const mesh = new WaveCircleMesh()
const created = (scene, { camera }) => {
  camera.position.set(0, 2, 0)

  // 添加网格到场景中。
  scene.add(mesh)
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## 自定义选项

<WaveCircleMeshOptions />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { WaveCircleMesh, AxisType } from 'three-vue3'

const mesh = new WaveCircleMesh({
  radius: 0.5,
  color: [0.98, 0.61, 0.6, 1],
  speed: 2,
  verticalAxis: AxisType.X
})
const created = (scene, { camera }) => {
  camera.position.set(2, 0, 0)

  // 添加网格到场景中。
  scene.add(mesh)
  mesh.position.set(...[0, 0.5, 0])
}
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## 构造函数参数

| 参数    | 属性         | 类型                             | 默认值               | 描述                                                                |
| ------- | ------------ | -------------------------------- | -------------------- | ------------------------------------------------------------------- |
| options | radius       | number                           | 1                    | `可选` 圆的半径。                                                   |
|         | color        | [number, number, number, number] | [0.6, 0.96, 0.98, 1] | `可选` 圆的颜色。                                                   |
|         | speed        | number                           | 1                    | `可选` 圆的波动速度。                                               |
|         | verticalAxis | AxisType                         | AxisType.Y           | `可选` 与圆面垂直的轴。 AxisType 枚举包含 `X` 轴、 `Y` 轴和 `Z` 轴. |
