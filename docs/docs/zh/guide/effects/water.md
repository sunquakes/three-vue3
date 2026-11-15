---
lang: zh-CN
title: 海洋水面
---

::: tip 类型
组件
:::

`<tv-water>` 在 `<tv-scene>` 中渲染电影感的浅海海面。一块 420 米的位移平面由 14 个方向波谱驱动，波谱同时用于 GPU 顶点节点和 CPU 采样器，因此水面线与着色器实际渲染的表面一致。

着色包含菲涅耳反射、GGX 太阳闪光、泡沫、基于深度的水色，以及周围场景的平面反射与折射。全部由 TSL 节点材质实现，因此在 `WebGPURenderer`（默认）和经由 `WebGLNodesHandler` 的传统 `WebGLRenderer` 上都能渲染。给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

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

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
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

::: tip
把相机放在水面之上不远处（`y` 约为 1–2），并略微向下看向地平线。原点附近会采样完整的波谱，因此波峰、泡沫和闪光最为明显。
:::

## 属性

| 属性              | 类型                                | 默认值              | 说明                                                       |
| ----------------- | ----------------------------------- | ------------------- | ---------------------------------------------------------- |
| sunDirection      | Vector3 \| [number, number, number] | `[-0.58, 0.1, -0.81]` | `可选` 从水面指向太阳的方向。                            |
| captureResolution | number                              | `512`               | `可选` 平面反射与折射捕获的最长边像素数。                  |
| segments          | number                              | `240`               | `可选` 平面每轴细分数。                                    |
| size              | number                              | `420`               | `可选` 水面平面尺寸（世界单位）。                          |

## 渲染器支持

- **WebGPU** 使用 `reflector()` 节点实现平面反射，使用 `viewportSharedTexture()` 实现折射，全部交由渲染图处理。
- **WebGL** 每帧将镜像相机渲染的平面反射，以及隐藏水面后的场景折射，渲染到半浮点渲染目标，再在水面着色器中采样。

捕获分辨率按绘制缓冲区尺寸计算，限定在最长边的 14% 到 42% 之间，并受 `captureResolution` 缩放。当相机低于动态水面时，水面会着色其背面，并暂停平面捕获，直到相机重新回到水面之上。

修改任意属性都会重建网格、几何体、贴图与渲染目标；组件卸载或 `<tv-scene>` 销毁时，所有资源都会被释放。
