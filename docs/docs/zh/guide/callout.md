---
lang: zh-CN
title: 标注
---

::: tip 类型
类
:::

`Callout` 从三维锚点向标签位置绘制一条引导线，可选显示锚点圆点和位于末端的 DOM 标签。线条可以是直线，也可以折成两段并带一个拐角；标签可以对齐到固定角，也可以沿底边滑动；标签位置还能通过 `moveTo` 做动画。标签动画与自动锚点刷新由标注自身的动画循环驱动，无需逐帧代码。

标签是一个 `CSS2DObject`，由 `<tv-scene>` 已经渲染的 `CSS2DRenderer` 负责显示。`content` 可以是纯字符串（会作为文本写入包装元素），也可以是任意你想挂载的 `HTMLElement`。容器元素会添加到 `document.body`，id 为 `callout-<uuid>`。

## 默认用法

<CalloutDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Callout } from 'three-vue3'

let callout: Callout | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  // 位于原点、被标注的立方体。
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())
  scene.add(box)

  const label = document.createElement('div')
  label.textContent = 'This is a box!'
  label.style.padding = '8px 14px'
  label.style.background = 'linear-gradient(180deg, #ff8a2b 0%, #e66400 100%)'
  label.style.borderRadius = '4px'
  label.style.color = '#1a0f00'
  label.style.fontSize = '16px'
  label.style.fontWeight = '600'
  label.style.pointerEvents = 'auto'
  label.style.whiteSpace = 'nowrap'

  // 起点在立方体角上，终点在右侧更远处。`autoAnchor` 让连接点朝向相机，
  // `attach()` 启动内部循环。
  callout = new Callout([0.5, 0.5, 0.5], [1.5, 1.0, 0.5], label, {
    color: '#ffffff',
    lineWidth: 2,
    lineShape: 'broken',
    bendAxis: 'x',
    bendRatio: 2 / 3,
    autoAnchor: true,
    dashed: false,
    showDot: true,
    dotColor: '#ffffff',
    dotRadius: 0.06
  })
  scene.add(callout.scene)
  callout.attach(camera)
}

onBeforeUnmount(() => {
  callout?.dispose()
  callout = undefined
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 360px;
}
</style>
```

:::

## 构造函数

```ts
new Callout(start: Position, end: Position, content: string | HTMLElement, options?: CalloutOptions)
```

| 名称    | 类型                   | 描述                                                       |
| ------- | ---------------------- | ---------------------------------------------------------- |
| start   | Position               | 引导线的锚点，世界坐标。                                   |
| end     | Position               | 标签位置，世界坐标；除非 `labelAnchor` 或 `autoAnchor` 另有设置，标签以该点为中心。 |
| content | string \| HTMLElement  | 标签内容。字符串会作为文本写入包装元素。                   |
| options | CalloutOptions         | 可选配置，见下文。                                         |

## 配置项

| 名称        | 类型             | 默认值         | 描述                                                                                       |
| ----------- | ---------------- | -------------- | ------------------------------------------------------------------------------------------ |
| color       | number \| string | `0xffffff`     | `可选` 线条颜色。                                                                          |
| lineWidth   | number           | `1`            | `可选` 线宽（仅 WebGL2 有效）。                                                            |
| lineShape   | LineShape        | `'broken'`     | `可选` 线条形状：`'straight'` 为直线，`'broken'` 为带拐角的 L 形折线。                     |
| bendAxis    | BendAxis         | `'auto'`       | `可选` 折线中平行于标签那一段所使用的主轴；`'auto'` 取差值最大的轴。                       |
| bendRatio   | number           | `0.45`         | `可选` 沿 `bendAxis` 从标签指向锚点的比例（0–1），决定拐角位置。                           |
| labelAnchor | LabelAnchor      | `'bottom-left'`| `可选` 标签的哪个角／点位于 `end`；`autoAnchor` 为 true 时忽略。                          |
| autoAnchor  | boolean          | `false`        | `可选` 根据 `end` 到 `start` 的屏幕方向，让连接点沿标签底边滑动。                          |
| dashed      | boolean          | `false`        | `可选` 是否使用虚线。                                                                      |
| dashSize    | number           | `0.1`          | `可选` 虚线的线段长度。                                                                    |
| gapSize     | number           | `0.05`         | `可选` 虚线的间隙长度。                                                                    |
| showDot     | boolean          | `true`         | `可选` 是否在起点显示锚点圆点。                                                            |
| dotColor    | number \| string | 与 `color` 相同 | `可选` 锚点圆点颜色。                                                                     |
| dotRadius   | number           | `0.05`         | `可选` 锚点圆点半径。                                                                      |
| showLabel   | boolean          | `true`         | `可选` 是否在末端显示标签。                                                                |

`LineShape` 为 `'straight' | 'broken'`，`BendAxis` 为 `'auto' | 'x' | 'y' | 'z'`，`LabelAnchor` 为 `'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`。

## 方法

| 名称                       | 描述                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| attach(camera)             | 保存 `autoAnchor` 使用的相机，并启动标注自身的刷新循环。                   |
| detach()                   | 停止刷新循环并停止跟踪相机。                                               |
| moveTo(end, duration)      | 把标签动画到新位置，`duration` 单位为毫秒。                                |
| setStart(start)            | 立即移动锚点。                                                             |
| setEnd(end)                | 立即移动标签点。                                                           |
| setLineShape(shape, opts?) | 在 `'straight'` 与 `'broken'` 之间切换，可选同时更新 `bendAxis` / `bendRatio`。 |
| dispose()                  | 销毁线条与圆点，移除标签 DOM 元素并解除相机绑定。                          |

## 类用法

```ts
import * as THREE from 'three'
import { Callout } from 'three-vue3'

const callout = new Callout(
  [0.5, 0.5, 0],
  [2, 1.5, 0],
  'A sphere in the scene',
  { color: '#8ab4ff', dashed: true }
)
scene.add(callout.scene)

// 只有使用 autoAnchor 时才需要绑定相机，让连接点跟随相机：
callout.attach(camera)

// 在 800 毫秒内把标签动画到新位置：
callout.moveTo([1.2, 2, 0], 800)

// 用自定义元素代替字符串：
const label = document.createElement('strong')
label.textContent = 'Custom'
label.style.color = '#ffd166'
const custom = new Callout([0, 0, 0], [1, 1, 0], label)

// 销毁时：
callout.dispose()
custom.dispose()
```
