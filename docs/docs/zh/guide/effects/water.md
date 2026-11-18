---
lang: zh-CN
title: 海洋水面
---

::: tip 类型
组件
:::

`<tv-water>` 在 `<tv-scene>` 中渲染电影感的浅海海面，是 [Evan Wallace 的 webgl-water](https://madebyevan.com/webgl-water/) 与 [react-three-lite](https://github.com/sunquakes/react-three-lite) `Water` 组件的移植版本，并扩展了多波 Gerstner 风格波谱、平面反射与折射，以及自定义水面轮廓。

一个 420 米的位移平面由 14 组波谱叠加分形噪声驱动。同一套 CPU 采样器也与雨滴碰撞高度图共享，因此 `height-map` 雨滴会精确落在动态海面上。

全部由 TSL 节点材质实现，因此在 `WebGPURenderer`（默认）和经由 `WebGLNodesHandler` 的传统 `WebGLRenderer` 上都能渲染。给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

## 默认用法

<WaterDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-water />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.58, 0.1, -0.81))
}
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

在 `<tv-water>` 初始化前设置 `globalParameterBus`，让水面与场景中的其他对象使用相同的太阳方向。水面会订阅后续方向更新，直到组件销毁。

## 自定义形状

传入凸 `[x, z]` 轮廓，或顶点可投影到 XZ 平面的 `BufferGeometry`，即可三角化出不规则水面。

<WaterShapeDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water :shape="LAKE_OUTLINE" :segments="160" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const LAKE_OUTLINE: [number, number][] = [
  [-8, -2.5],
  [-4.5, -5.5],
  [1.5, -6],
  [6.5, -3.5],
  [8, 1],
  [4.5, 5],
  [-1.5, 5.5],
  [-6.5, 3]
]

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  if (!camera) return
  camera.position.set(0, 6, 15)
  if (controls) controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
}
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

## 属性

| 属性              | 类型                                | 默认值      | 说明                                                                             |
| ----------------- | ----------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| captureResolution | number                              | `512`       | `可选` 平面反射与折射捕获的最长边设备像素数，限制在 64–2048 且不超过绘制缓冲区。 |
| segments          | number                              | `240`       | `可选` 每轴平面细分数，限制在 16–1024。使用 `shape` 时，它表示轮廓总采样预算。   |
| size              | number                              | `420`       | `可选` 方形水面的边长，单位为场景世界单位。提供 `shape` 时忽略。                 |
| shape             | WaterPoolOutline \| BufferGeometry  | —           | `可选` 自定义凸水面轮廓，或投影到 XZ 平面的几何体。                              |
| position          | Vector3 \| [number, number, number] | `[0, 0, 0]` | `可选` 水面中心的世界坐标。                                                      |

```ts
type WaterPoolOutline = readonly (readonly [number, number])[]
```

自定义点与几何体顶点会简化为凸包并移除共线点。凸包必须包含原点，且至少具有三个非共线点。未提供 `shape` 时，`segments` 细分 `size × size` 平面的每条轴；提供后则控制轮廓总采样预算。`position` 同时移动网格与反射平面，水下采样也始终以定位后的水面为基准。

## 渲染器支持

- **WebGPU** 通过 `WebGPURenderer` 直接执行 TSL 节点图。
- **WebGL** 通过 `WebGLNodesHandler` 将同一份节点图编译为 GLSL。

修改属性会重建网格、几何体、贴图与渲染目标。替换资源及组件卸载时，旧资源、监听器、动画回调与太阳方向订阅都会被释放。
