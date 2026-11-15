---
lang: zh-CN
title: 光柱
---

::: tip 类型
类
:::

圆锥形光柱，由半透明外锥、更亮的内芯、柱顶的呼吸光晕和地面上扩散的两道脉冲光环组成。常用作数据标记：把归一化数值映射到 `height` 配置项，柱体越高代表数值越大。呼吸光晕与脉冲光环由光柱自身的动画循环驱动。

## 默认用法

<LightPillarDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { LightPillar } from 'three-vue3'

const pillars: LightPillar[] = []

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 2.4, 6)
  camera.lookAt(0, 1, 0)

  const data: Array<{ x: number; z: number; value: number; color: number }> = [
    { x: -2.2, z: 0, value: 0.35, color: 0x00ffff },
    { x: 0, z: -0.6, value: 1, color: 0x36e0a0 },
    { x: 2.2, z: 0, value: 0.62, color: 0xffb347 }
  ]

  data.forEach(({ x, z, value, color }) => {
    const pillar = new LightPillar({
      color,
      // 把归一化的数据值映射为光柱高度
      height: 1 + value * 2.4,
      radius: 0.22
    })
    pillar.position.set(x, 0, z)
    scene.add(pillar)
    pillars.push(pillar)
  })
}

onBeforeUnmount(() => {
  pillars.forEach((pillar) => pillar.dispose())
  pillars.length = 0
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

| 名称       | 类型    | 默认值       | 描述                                           |
| ---------- | ------- | ------------ | ---------------------------------------------- |
| color      | number  | `0x00ffff`   | `可选` 光柱颜色。                              |
| height     | number  | `3`          | `可选` 沿 Y 轴的柱体高度，底部位于 `y = 0`。    |
| radius     | number  | `0.3`        | `可选` 锥体底部半径。                          |
| opacity    | number  | `1`          | `可选` 全局不透明度系数（0-1）。               |
| speed      | number  | `1`          | `可选` 动画速度系数。                          |
| segments   | number  | `32`         | `可选` 锥体与光环的径向分段数。                |
| glow       | boolean | `true`       | `可选` 是否渲染柱顶的呼吸光晕。                |
| ring       | boolean | `true`       | `可选` 是否渲染地面上的两道扩散脉冲光环。      |
| ringRadius | number  | `radius * 3` | `可选` 脉冲光环扩散到的外半径。                |

## 方法

| 名称        | 参数                           | 描述                                                                       |
| ----------- | ------------------------------ | -------------------------------------------------------------------------- |
| constructor | (options?: LightPillarOptions) | 创建光柱。它继承自 `THREE.Group`，可直接加入场景并通过 `position` 定位。 |
| dispose     | () => void                     | 销毁光柱并从场景中移除。                                                   |

## 类用法

```ts
import { LightPillar } from 'three-vue3'

const pillar = new LightPillar({ color: 0x36e0a0, height: 3, radius: 0.22 })
pillar.position.set(0, 0, 0)
scene.add(pillar)

// 光晕与光环由光柱自身动画循环驱动；销毁时：
pillar.dispose()
```
