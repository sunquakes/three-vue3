---
lang: zh-CN
title: 模型旋转器
---

::: tip 类型
类
:::

`ModelRotator` 使用独立的 `requestAnimationFrame` 循环旋转任意 `THREE.Object3D`，与场景渲染循环解耦。可随时暂停、恢复、修改速度或旋转轴，并在模型移除时调用 `dispose()`。

## 默认用法

<ModelRotatorDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, ModelRotator } from 'three-vue3'
import type * as THREE from 'three'

let rotator: ModelRotator | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance-draco.glb', { draco: true })
  model.position.set(0, 0, 0)
  scene.add(model)

  rotator = new ModelRotator(model, {
    axis: 'y',
    speed: 0.5,
    autoStart: true
  })
}

onBeforeUnmount(() => {
  rotator?.dispose()
  rotator = undefined
  if (model) {
    model.parent?.remove(model)
    model = undefined
  }
})
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

## 选项

| 名称      | 类型              | 默认值 | 描述                                 |
| --------- | ----------------- | ------ | ------------------------------------ |
| axis      | 'x' \| 'y' \| 'z' | `'y'`  | `可选` 旋转轴。                       |
| speed     | number            | `0.5`  | `可选` 旋转速度（弧度/秒）。          |
| autoStart | boolean           | `true` | `可选` 创建实例后是否立即开始旋转。   |

## 方法

| 名称     | 参数                             | 描述                             |
| -------- | -------------------------------- | -------------------------------- |
| play     | () => void                       | 开始或恢复旋转。                 |
| pause    | () => void                       | 暂停旋转，保留当前角度。         |
| stop     | () => void                       | 暂停并把旋转角度重置为零。       |
| setSpeed | (speed: number) => void          | 更新旋转速度。                   |
| setAxis  | (axis: 'x' \| 'y' \| 'z') => void | 更新旋转轴。                    |
| dispose  | () => void                       | 停止循环并释放动画帧。           |
