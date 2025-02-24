---
lang: zh-CN
title: 动态元素
---

::: tip type
类
:::

## 默认用法

<MovableElement />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { ME, GLTFLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // 加载模型到场景中。
  const model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // 创建动态元素。
  const element = new ME(model, [0, 0, -1])

  // 在10秒内将元素从 [0, 0, -1] 移动到 [0, 0, 0]。
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

## 属性

| 名称  | 类型        | 描述                 |
| ----- | ----------- | -------------------- |
| scene | THREE.Group | 要展示和移动的模型。 |

## 方法

| 名称        | 参数                                                             | 描述                                      |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------- |
| constructor | (model: THREE.Group, position: [number, number, number]) => void | `model` 操作的模型；`position` 初始位置。 |
