---
lang: zh-CN
title: 光晕精灵
---

::: tip 类型
类
:::

始终面向相机的光晕圆点，使用程序生成的径向渐变贴图并采用叠加混合。它永远正面朝向观察者，且只消耗一个四边形，因此适合表现点状高光：远处的行星、信标、信号源或镜头光晕。

设置 `pulsePeriod` 后精灵会自行呼吸脉动——无需渲染循环——`phase` 可以让多个脉动精灵错开节奏。

## 默认用法

<GlowSpriteDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(8, 10, 20)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GlowSprite } from 'three-vue3'

interface DotConfig {
  position: [number, number, number]
  size: number
  color: number
  tint: number
  opacity: number
  /** 可选的自动脉动：一次呼吸的秒数 */
  pulsePeriod?: number
  /** 可选的脉动相位偏移（0-1） */
  phase?: number
}

// 几个不同尺寸的光晕圆点：淡蓝色的地球和两颗较暗的星，其中一颗像信标一样
// 自行脉动——无需渲染循环。
const dots: DotConfig[] = [
  { position: [0, 1, 0], size: 3.2, color: 0x8ecbff, tint: 0xbcdfff, opacity: 0.9 },
  {
    position: [-3.4, -0.8, -2],
    size: 1.4,
    color: 0xffb066,
    tint: 0xffd9a8,
    opacity: 0.8,
    pulsePeriod: 2.2,
    phase: 0.3
  },
  { position: [3.6, 2.4, -4], size: 2.2, color: 0x9ce8ff, tint: 0xd8f4ff, opacity: 0.85 }
]

const sprites: GlowSprite[] = []

const created = (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 0.8, 7)
  camera.lookAt(0, 0.8, 0)

  dots.forEach((dot) => {
    const sprite = new GlowSprite({
      size: dot.size,
      color: dot.color,
      tint: dot.tint,
      opacity: dot.opacity,
      pulsePeriod: dot.pulsePeriod,
      phase: dot.phase
    })
    sprite.position.set(...dot.position)
    scene.add(sprite)
    sprites.push(sprite)
  })
}

onBeforeUnmount(() => {
  sprites.forEach((sprite) => sprite.dispose())
  sprites.length = 0
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

| 名称        | 类型   | 默认值     | 描述                                                                                     |
| ----------- | ------ | ---------- | ---------------------------------------------------------------------------------------- |
| color       | number | `0x8ecbff` | `可选` 径向渐变光晕的颜色。                                                              |
| tint        | number | `0xbcdfff` | `可选` 叠加到贴图上的色调，让同一张贴图可以呈现多种色相。                               |
| size        | number | `3.2`      | `可选` 精灵在世界空间中的尺寸。                                                          |
| opacity     | number | `0.9`      | `可选` 全局不透明度系数（0-1）。                                                         |
| resolution  | number | `128`      | `可选` 生成的光晕贴图分辨率。                                                            |
| pulsePeriod | number | -          | `可选` 一次呼吸脉动的秒数。缩放浮动约 12%，不透明度在配置值的 75%-100% 之间变化。        |
| phase       | number | `0`        | `可选` 0-1 范围内的相位偏移，用于错开多个脉动精灵。                                      |

## 方法

| 名称        | 参数                           | 描述                                                                |
| ----------- | ------------------------------ | ------------------------------------------------------------------- |
| constructor | (options?: GlowSpriteOptions)  | 创建精灵。它继承自 `THREE.Sprite`，定位后直接加入场景即可。         |
| dispose     | () => void                     | 销毁生成的贴图与材质，并从场景中移除。                              |

## 类用法

```ts
import { GlowSprite } from 'three-vue3'

const glow = new GlowSprite({ color: 0x8ecbff, size: 3.2, pulsePeriod: 2.2 })
glow.position.set(0, 1, 0)
scene.add(glow)

// 脉动由精灵自身时钟驱动；销毁时调用：
glow.dispose()
```
