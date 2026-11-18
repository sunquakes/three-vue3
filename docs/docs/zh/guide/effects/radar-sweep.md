---
lang: zh-CN
title: 雷达扫描
---

::: tip 类型
类
:::

`RadarSweep` 是一种地面雷达脉冲：环形波带从网格原点向外扩散，并被漂移噪声打散，因此波前不会看起来像一个画出来的圆。它叠加了前缘波峰、紧随其后的较弱首次回波、已扫过区域的微弱足迹，以及埋藏目标上的短促亮点。

波带会通过 `heightAt` 采样器一次性贴合到地面，因此能顺应起伏地形。请在添加到场景之前设置网格位置（波带会在 `added` 时重建），或在移动后调用 `rebuild()`。

传入 `period` 后脉冲会自动循环——扫描由内部时钟推进。只有在需要手动控制进度时，才需要调用 `update(delta)`。

## 默认用法

<RadarSweepDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { RadarSweep } from 'three-vue3'

let effect: RadarSweep | undefined
let ground: THREE.Mesh | undefined

// 地面网格与雷达波带共用的平缓沙丘起伏，让脉冲明显贴合地形，
// 而不是直接切穿地面。
function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.55) * 0.22 + Math.cos(z * 0.4) * 0.18
}

const created = (scene, { camera }) => {
  camera.position.set(0, 7, 10)
  camera.lookAt(0, 0, 0)

  // 用与波带相同的采样器把地面抬起。
  const geometry = new THREE.PlaneGeometry(22, 22, 96, 96)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)))
  }
  geometry.computeVertexNormals()

  ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x4a3a33, roughness: 1 })
  )
  scene.add(ground)

  // `period` 让扫描自行循环，无需动画循环。
  effect = new RadarSweep({ radius: 8, heightAt: terrainHeight, period: 2.4 })
  scene.add(effect)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
  if (ground) {
    ground.parent?.remove(ground)
    ground.geometry.dispose()
    ;(ground.material as THREE.Material).dispose()
    ground = undefined
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

## 配置项

| 名称       | 类型                             | 默认值     | 描述                                                         |
| ---------- | -------------------------------- | ---------- | ------------------------------------------------------------ |
| radius     | number                           | `8`        | `可选` 脉冲扩散到的外半径。                                   |
| segments   | number                           | `128`      | `可选` 环形几何体的径向分段数。                               |
| rings      | number                           | `20`       | `可选` 环形几何体的同心分段数。                               |
| heightAt   | (x: number, z: number) => number | —          | `可选` 世界空间地面采样器，用于让波带贴合地形。               |
| color      | number                           | `0x57ccff` | `可选` 扫描波带的颜色。                                       |
| crestColor | number                           | `0xa8f5ff` | `可选` 前缘波峰的颜色。                                       |
| echoDelay  | number                           | `1.8`      | `可选` 较弱首次回波落后于波峰的距离。                         |
| opacity    | number                           | `0.9`      | `可选` 整个脉冲的透明度系数。                                 |
| lift       | number                           | `0.04`     | `可选` 高于地形的高度偏移。                                   |
| progress   | number                           | `0`        | `可选` 脉冲初始进度（0-1）。                                  |
| period     | number                           | —          | `可选` 一次完整扫描的秒数；设置后脉冲自行循环。               |

## 类用法

```ts
import { RadarSweep } from 'three-vue3'

const sweep = new RadarSweep({
  radius: 8,
  period: 2.4,
  heightAt: (x, z) => Math.sin(x * 0.5 + z * 0.3) * 0.2
})
sweep.position.set(0, 0, 0)
scene.add(sweep)

// 设置 `period` 后脉冲会自行推进动画。

// 销毁时：
sweep.dispose()
```
