---
lang: zh-CN
title: 信号波
---

::: tip 类型
类
:::

`SignalWave` 渲染一次广播式信号脉冲。一个始终面向相机的四边形在片元着色器中绘制出柔和的圆弧；当 `life` 从 0 变到 1 时同步放大网格，每次脉冲就会像向外扩散并逐渐消散的信号。

自动模式下传入 `travel`，波会用自己的时钟沿 `bearing` 从 `origin` 自动飞行——位置、缩放、朝向和 `life` 全部由同一个时钟驱动。`count` 会创建相位错开的子脉冲，因此一个对象就能渲染出整串信号。

省略 `travel` 即为手动模式：自行设置位置、缩放与朝向，自行驱动 `life`，并用 `setDirection()` 与 `faceCamera()` 调整圆弧朝向。

## 默认用法

<SignalWaveDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { SignalWave } from 'three-vue3'

let effect: SignalWave | undefined

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 3.2, 11)
  camera.lookAt(0, 5, 0)

  // 设置 `travel` 后脉冲会沿 bearing 自动上升，`count` 把六个脉冲按相位错开，
  // 无需任何渲染循环。
  effect = new SignalWave({
    bearing: [0.24, 1, 0],
    travel: 26,
    period: 26 / 7,
    count: 6,
    startScale: 0.45,
    endScale: 3.4
  })
  scene.add(effect)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
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

| 名称       | 类型                     | 默认值      | 描述                                                         |
| ---------- | ------------------------ | ----------- | ------------------------------------------------------------ |
| innerColor | number                   | `0x2985ff`  | `可选` 圆弧较淡处的颜色。                                     |
| outerColor | number                   | `0xbdeaff`  | `可选` 圆弧较密处的颜色。                                     |
| direction  | [number, number]         | `[1, 0]`    | `可选` 圆弧在平面内张开的朝向。                               |
| life       | number                   | `0`         | `可选` 初始生命值（0-1）。                                    |
| bearing    | [number, number, number] | `[0, 1, 0]` | `可选` 脉冲飞行及圆弧张开的世界空间朝向，自动模式使用。       |
| origin     | [number, number, number] | `[0, 0, 0]` | `可选` 飞行起点的世界空间位置。                               |
| travel     | number                   | —           | `可选` 一个周期内飞行的世界距离；设置后自动播放动画。         |
| period     | number                   | `2.4`       | `可选` 自动模式下每个周期的秒数。                             |
| phase      | number                   | `0`         | `可选` 用于错开脉冲的相位偏移（0-1）。                        |
| count      | number                   | `1`         | `可选` 作为子对象创建的错相脉冲数量。                         |
| startScale | number                   | `0.45`      | `可选` 周期开始时的缩放。                                     |
| endScale   | number                   | `3.4`       | `可选` 周期结束时的缩放。                                     |

## 类用法

```ts
import { SignalWave } from 'three-vue3'

const signal = new SignalWave({
  travel: 26,
  period: 26 / 7,
  count: 6,
  bearing: [0.24, 1, 0]
})
scene.add(signal)

// 脉冲会自行飞行；销毁时调用：
signal.dispose()
```
