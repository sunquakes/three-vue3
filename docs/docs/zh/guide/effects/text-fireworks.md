---
lang: zh-CN
title: 文字烟花
---

::: tip 类型
类
:::

`TextFireworks` 会把一行文字采样成字形粒子，并把它变成一场烟花。调用 `launch()` 后文字四散成若干组彩色爆炸，随后每个粒子又被拉回它原来的像素位置，重新看到可读的文字。每个粒子都是一块面向相机、以 CSS 像素定尺寸的四边形，因此无论距离多远都能保持一致的观感。

文字会被绘制到离屏 canvas 上并按固定网格采样，`worldScale` 负责把采样像素换算成世界单位。该类会自行推进时间轴，`update(delta)` 是可选的。

## 默认用法

<TextFireworksDemo />

::: details 点击我查看代码

```vue
<template>
  <div>
    <div class="toolbar">
      <input v-model="text" class="input" placeholder="输入一句话" @keyup.enter="launch" />
      <button type="button" class="button" @click="launch">发射</button>
    </div>
    <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue'
import { TextFireworks } from 'three-vue3'

const DEFAULT_TEXT = 'Good things are coming'

const text = ref(DEFAULT_TEXT)
let effect: TextFireworks | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 1, 6)
  camera.lookAt(0, 1, 0)

  effect = new TextFireworks({ text: DEFAULT_TEXT })
  scene.add(effect)
}

const launch = () => {
  if (!effect) return
  // 采样新的句子会重建粒子，然后重新播放一轮。
  effect.setText(text.value)
  effect.launch()
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
.toolbar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.button {
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--vp-c-white);
  background: var(--vp-c-brand-1);
  border: none;
}
</style>
```

:::

## 配置项

| 名称          | 类型                  | 默认值                                          | 描述                                                       |
| ------------- | --------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| text          | string                | `'Good things are coming'`                      | `可选` 被采样为粒子的文字。                                |
| colors        | ColorRepresentation[] | `['#ff8a3d', '#ffd166', '#4aa8ff', '#b06cff']`  | `可选` 从左到右各组爆炸的颜色。                            |
| burstCenters  | [number, number][]    | 四个错开的位置                                  | `可选` 各组爆炸中心，单位为世界单位。                      |
| burstScale    | number                | `1`                                             | `可选` 同时作用于爆炸中心和径向扩散的缩放。                |
| groupDelay    | number                | `0.22`                                          | `可选` 相邻两组起爆的间隔，单位为秒。                      |
| groupJitter   | number                | `0.2`                                           | `可选` 每个粒子的额外随机延迟，单位为秒。                  |
| pointSize     | number                | `3.4`                                           | `可选` 粒子大小，单位为 CSS 像素。                         |
| trailOffset   | number                | `0.105`                                         | `可选` 拖尾层相对主层滞后的秒数。                          |
| trailOpacity  | number                | `0.34`                                          | `可选` 拖尾层的不透明度倍率。                              |
| restColor     | ColorRepresentation   | `0xffd4ad`                                      | `可选` 文字静止以及最终回落的颜色。                        |
| worldScale    | number                | `0.0068`                                        | `可选` 每个采样到的 canvas 像素对应的世界单位。            |
| offsetY       | number                | `0.55`                                          | `可选` 文字中心在世界坐标中的纵向偏移。                    |
| autoPlay      | boolean               | `true`                                          | `可选` 创建后是否自动播放一次。                            |
| autoPlayDelay | number                | `1.2`                                           | `可选` 自动起爆前的等待秒数，由 `update(delta)` 累计。     |
| seed          | number                | `1`                                             | `可选` 每个粒子确定性随机数的种子。                        |

## 成员

| 名称          | 类型   | 描述                                 |
| ------------- | ------ | ------------------------------------ |
| points        | Mesh   | 主粒子层。                           |
| trail         | Mesh   | 滞后、更暗的同批粒子拖尾层。         |
| text          | string | 当前被采样为粒子云的文字。           |
| particleCount | number | 字形粒子数量，每个都渲染为一块公告板四边形。 |
| duration      | number | 一轮「升起 / 爆炸 / 回落」的时长，单位为秒。 |
| phase         | number | 时间轴上的当前位置，单位为秒。       |
| playing       | boolean| 时间轴当前是否在推进。               |

## 方法

| 名称          | 描述                                                       |
| ------------- | ---------------------------------------------------------- |
| update(delta) | 可选：手动推进时间轴；该类本身也会自行计时。              |
| launch()      | 从 `0` 重新开始「升起 / 爆炸 / 回落」这一轮。              |
| setText(text) | 重新采样新的文字，并回到静止状态。                         |
| dispose()     | 销毁几何体与两个材质，并从父级移除整个分组。               |

## 类用法

```ts
import { TextFireworks } from 'three-vue3'

const effect = new TextFireworks({ text: 'Good things are coming', autoPlay: false })
scene.add(effect)

// 效果会自行推进动画，`update(delta)` 是可选的。

// 用相同文字重播，或采样新的一行：
effect.launch()
effect.setText('Hello')

// 销毁时：
effect.dispose()
```
