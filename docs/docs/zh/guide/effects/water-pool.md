---
lang: zh-CN
title: 互动水池
---

::: tip 类型
组件
:::

`<tv-water-pool>` 在 `<tv-scene>` 中渲染一个可交互的射线追踪水池，是 [Evan Wallace 的 webgl-water](https://madebyevan.com/webgl-water/) 的移植版本，只是把浮球换成了各种形状的方块。

CPU 高度场驱动涟漪与焦散光照贴图，并以数据纹理上传到 GPU。水面、不规则的瓷砖池壁与漂浮的方块都在片元着色器中用解析射线着色，因此无论是在 WebGPU 还是 WebGL 渲染器上，反射、折射与焦散效果完全一致，且不需要额外的渲染通道。

## 默认用法

<WaterPoolDemo />

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
    <tv-water-pool />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  if (!camera) return
  camera.position.set(1.7, 1.65, 2.1)
  if (controls) controls.target.set(0, -0.3, 0)
  camera.lookAt(0, -0.3, 0)
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

在水池内拖动可以产生涟漪，拖动方块可以推动它，在水池外拖动可以旋转相机。

## 属性

| 属性         | 类型                                                                                                                   | 默认值             | 说明                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ |
| resolution   | number                                                                                                                 | `128`              | `可选` 每轴高度场网格数量，限制在 8–512。         |
| segments     | number                                                                                                                 | `160`              | `可选` 沿不规则池壁轮廓的细分数。                 |
| boxes        | `{ position: [number, number, number]; size: [number, number, number]; color?: string }[]`                             | 三个方块           | `可选` 漂浮在水池中的不同形状方块。               |
| sunDirection | Vector3 \| [number, number, number]                                                                                    | `[0.55, 0.9, 0.35]` | `可选` 从水池指向太阳的方向。                   |
| autoRipples  | boolean                                                                                                                | `true`             | `可选` 每 1.8 秒自动产生一个随机涟漪。            |
| interactive  | boolean                                                                                                                | `true`             | `可选` 允许拖动水面与方块。                       |
| sky          | boolean                                                                                                                | `true`             | `可选` 在水池后方绘制程序化天空穹顶。             |

`boxes` 的每一项描述一个方块：`position` 是中心位置，`size` 是完整尺寸，`color` 是可选的 CSS 颜色。每个方块都会参与水面的射线追踪，因此方块越多着色器开销越大，少量形状即可保持流畅。

## 实现原理

- CPU 高度场按网格保存 `(高度, 速度, 法线.x, 法线.z)`，并运行与原版一致的两次波动方程迭代。数据以 RGBA 半浮点 `DataTexture` 上传，在顶点节点中位移水面。
- 焦散贴图通过把每个水面网格沿折射后的太阳光线投影到池底生成。投影的局部压缩会把光线聚集，因此焦散贴图按水面坐标索引，池底像素再按自己的太阳光线入射点进行采样。
- 水面、不规则的瓷砖池壁与方块均在 TSL 中用解析射线着色：水面反射并折射方块、池壁与程序化天空，池底接收动态焦散，每个方块还会投下柔和阴影。
- 方块在水中移动时，会按其底面轮廓位移高度场，因此拖动方块会留下扩散的尾迹。
- 模拟使用固定 1/60 秒的时间累加器，每帧最多补算三步，因此涟漪在任何刷新率下表现一致。

瓷砖贴图在 canvas 中生成，因此组件不会下载任何资源。组件卸载或属性变化时，几何体、材质、数据纹理、指针监听与动画帧都会被释放。

## 渲染器支持

所有着色均使用 TSL 节点材质，两种渲染器均可运行：

- **WebGPU** 通过 `WebGPURenderer` 直接执行节点图。
- **WebGL** 通过 `WebGLNodesHandler` 将同一份 TSL 节点图编译为 GLSL。

池壁、方块与天空都在着色器内进行射线追踪，而不是从场景中捕获，因此不涉及渲染目标，两种后端输出一致。
