---
lang: zh-CN
title: 烟花
---

::: tip 类型
类
:::

`Fireworks` 是一发 GPU 动画烟花。先是一道从原点升起的发射拖尾，随后炸开成球形喷洒的抛物线弯曲丝带，头部发光、尾部通过噪声逐渐溶解。全部运动都在 TSL 节点材质中完成，因此一发烟花只需要一次绘制调用，并且同时支持 WebGPU 与 WebGL。

烟花会自己推进内部时钟，`update(delta)` 是可选的——只有想手动控制时间轴时才需要调用。每根丝带都是一条面向相机的四边形带，方向由投影到球面上的正二十面体生成，因此 `detail` 控制爆炸产生的丝带数量。

## 默认用法

<FireworksDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="#1a1a2e" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Fireworks } from 'three-vue3'

let effects: Fireworks[] = []

// 一段小型编排演出：每发烟花的颜色、爆炸高度、扩散范围、屏幕位置与
// 各阶段时长都不同，使它们错峰炸开，而不是齐射一次。
const shells = [
  { color: 0xffd4a0, height: 6.6, scale: 3.6, offset: [-3.6, 0, -1.5], launch: 1.25, burst: 1.9 },
  { color: 0xff6b6b, height: 7.4, scale: 3.2, offset: [3.2, 0, -0.8], launch: 1.5, burst: 2.2 },
  { color: 0x7ad7ff, height: 5.9, scale: 3.9, offset: [-1.4, 0, 1.6], launch: 1.7, burst: 1.6 },
  { color: 0xffe14d, height: 8.1, scale: 3.1, offset: [1.8, 0, -2.4], launch: 1.35, burst: 2.4 },
  { color: 0xb98bff, height: 6.9, scale: 3.5, offset: [-4.4, 0, 1.2], launch: 1.6, burst: 1.8 },
  { color: 0x66ffb2, height: 7.7, scale: 3.3, offset: [4.1, 0, 1.8], launch: 1.2, burst: 2.1 },
  { color: 0xffffff, height: 6.2, scale: 3.8, offset: [0.2, 0, 0.4], launch: 1.45, burst: 1.7 },
  { color: 0xff8ad4, height: 8.4, scale: 3.0, offset: [-2.6, 0, -2.8], launch: 1.75, burst: 2.3 },
  { color: 0xffa54d, height: 7.1, scale: 3.4, offset: [2.7, 0, 2.6], launch: 1.3, burst: 1.95 },
  { color: 0x8ab4ff, height: 6.8, scale: 3.7, offset: [-0.9, 0, -1.1], launch: 1.55, burst: 2.05 }
]

const created = (scene, { camera }) => {
  camera.position.set(0, 6, 17)
  camera.lookAt(0, 6, 0)

  effects = shells.map((shell) => {
    const fireworks = new Fireworks({
      color: shell.color,
      burstHeight: shell.height,
      burstScale: shell.scale,
      burstPositionOffset: new THREE.Vector3(shell.offset[0], shell.offset[1], shell.offset[2]),
      launchDuration: shell.launch,
      burstDuration: shell.burst,
      loop: true
    })
    scene.add(fireworks)
    return fireworks
  })
}

onBeforeUnmount(() => {
  for (const effect of effects) effect.dispose()
  effects = []
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

| 名称                | 类型                | 默认值        | 描述                                                                     |
| ------------------- | ------------------- | ------------- | ------------------------------------------------------------------------ |
| radius              | number              | `1`           | `可选` 爆炸丝带的目标长度半径，烘焙进几何体。                            |
| detail              | number              | `0`           | `可选` 正二十面体细分级别，烘焙进几何体；越大爆炸丝带越多。              |
| segments            | number              | `5`           | `可选` 沿每条丝带采样的段数，烘焙进几何体。                              |
| gravity             | number              | `1`           | `可选` 重力抛物线系数，烘焙进几何体。                                    |
| width               | number              | `0.1`         | `可选` 丝带半宽。                                                        |
| startTime           | number              | `0`           | `可选` 动画开始时间，单位为秒。                                          |
| launchDuration      | number              | `1.5`         | `可选` 发射阶段时长，单位为秒。                                          |
| delayDuration       | number              | `-0.4`        | `可选` 发射与爆炸之间的延迟，单位为秒；可以为负值让两个阶段重叠。        |
| burstDuration       | number              | `2`           | `可选` 爆炸阶段时长，单位为秒。                                          |
| burstHeight         | number              | `6.5`         | `可选` 爆炸点在局部 Y 轴上的高度。                                       |
| burstScale          | number              | `3.5`         | `可选` 爆炸整体缩放。                                                    |
| burstPositionOffset | Vector3             | `(0, 0, 0)`   | `可选` 爆炸原点偏移。                                                    |
| loop                | boolean             | `true`        | `可选` 一轮播放结束后是否重新播放。                                      |
| color               | ColorRepresentation | `'#ffd4a0'`   | `可选` 丝带基础颜色。                                                    |
| bloomIntensity      | number              | `9`           | `可选` 头部辉光强度。                                                    |
| bloomFalloff        | number              | `18`          | `可选` 头部辉光长度指数，值越大发光尖端越集中。                          |
| noiseFalloff        | number              | `3`           | `可选` 噪声溶解的时间指数。                                              |
| noiseScale          | Vector2             | `(10, 200)`   | `可选` 噪声 UV 缩放，格式为 `(横向, 纵向)`。                             |

## 类用法

```ts
import * as THREE from 'three'
import { Fireworks } from 'three-vue3'

const shell = new Fireworks({
  color: '#ffd166',
  burstHeight: 6.5,
  burstScale: 3.5,
  burstPositionOffset: new THREE.Vector3(0, 0, 0)
})
scene.add(shell)

// 烟花会自行推进动画；`update(delta)` 仅在需要手动驱动时间轴时使用。

// 实时调整，uniform 会就地更新：
shell.width = 0.14
shell.burstScale = 4
shell.color = '#4aa8ff'

// 重新开始当前这一轮：
shell.restart()

// 销毁时：
shell.dispose()
```
