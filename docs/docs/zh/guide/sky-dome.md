---
lang: zh-CN
title: 天空穹顶
---

::: tip 类型
类
:::

`SkyDome` 是一个带低角度太阳的渐变天空球：从地平线到天顶的四段色带、一圈宽光晕以及一个圆形太阳。它使用 TSL 节点材质，因此同一个类既能运行在 WebGPU 渲染器上，也能通过 `WebGLNodesHandler` 运行在 WebGL 上。

未传入 `sunDirection` 时，穹顶会跟随 `globalParameterBus`，因此更新全局太阳方向就会自动更新天空。

## 默认用法

<SkyDomeDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { SkyDome, globalParameterBus } from 'three-vue3'

let dome: SkyDome | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0.8, 7)
  camera.lookAt(0, 0.8, 0)

  // 一个共享的太阳方向驱动场景内的所有效果。
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.78, 0.2, -0.6))

  dome = new SkyDome()
  scene.add(dome)
}

onBeforeUnmount(() => {
  dome?.dispose()
  dome = undefined
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

| 名称          | 类型                     | 默认值                 | 描述                                 |
| ------------- | ------------------------ | ---------------------- | ------------------------------------ |
| radius        | number                   | `420`                  | `可选` 穹顶球半径。                   |
| horizonColor  | number                   | `0xf27536`             | `可选` 地平线色带的颜色。             |
| lowerSkyColor | number                   | `0x803624`             | `可选` 地平线稍上方的颜色。           |
| upperSkyColor | number                   | `0x260f13`             | `可选` 中间色带的颜色。               |
| zenithColor   | number                   | `0x060409`             | `可选` 天顶的颜色。                   |
| sunDirection  | [number, number, number] | 来自参数总线           | `可选` 太阳方向，内部会归一化。       |
| glowColor     | number                   | `0xff9947`             | `可选` 太阳光晕的颜色。               |
| sunColor      | number                   | `0xffe0b8`             | `可选` 太阳圆盘的颜色。               |
| sunIntensity  | number                   | `2.4`                  | `可选` 太阳圆盘的亮度倍数。           |
| sunSize       | number                   | `10`                   | `可选` 太阳圆盘的角直径（度）。       |
| segments      | number                   | `48`                   | `可选` 球体的水平分段数。             |

## 方法

| 名称            | 参数                                                 | 描述                         |
| --------------- | ---------------------------------------------------- | ---------------------------- |
| setSunDirection | (direction: THREE.Vector3 \| [number, number, number]) => void | 让穹顶朝向新的太阳方向。 |
| dispose         | () => void                                           | 取消订阅并释放几何体与材质。 |
