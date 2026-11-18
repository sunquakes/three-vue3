---
lang: zh-CN
title: 互动水池
---

::: tip 类型
组件
:::

`<tv-water-pool>` 在 `<tv-scene>` 中渲染一个可交互的射线追踪水池，是 [Evan Wallace 的 webgl-water](https://madebyevan.com/webgl-water/) 与 [react-three-lite](https://github.com/sunquakes/react-three-lite) `WaterPool` 组件的移植版本。

CPU 高度场驱动涟漪与焦散光照贴图，并以数据纹理上传到 GPU。水面、瓷砖池壁与程序化天空都在片元着色器中通过解析射线着色，因此 WebGPU 与 WebGL 的反射、折射和焦散结果一致，且不需要额外的场景捕获。

## 默认用法

<WaterPoolDemo />

::: details 点击我查看水池设置

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water-pool :shape="WATER_OUTLINE" :scale="WATER_SCALE" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const WATER_SCALE = 0.7
const TUB_SCALE: [number, number, number] = [1.59, 1.15, 0.868]
const WATER_HALF_X = (0.33 * TUB_SCALE[0] + 0.02) / WATER_SCALE
const WATER_HALF_Z = (0.72 * TUB_SCALE[2] + 0.02) / WATER_SCALE
const WATER_OUTLINE: [number, number][] = [
  [-WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, WATER_HALF_Z],
  [-WATER_HALF_X, WATER_HALF_Z]
]

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.55, 0.9, 0.35))
  if (!camera) return
  camera.position.set(1.75, 2.2, 2.0)
  if (controls) controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
}
</script>
```

:::

在线示例在不使用 Draco 的情况下加载 `/models/water-tub.glb`，缩放为 `[1.59, 1.15, 0.868]`，位置为 `[0, 0.09 - 0.53 * 1.15, 0]`。其 `SkyDome` 使用地平线 `0x94c2f0`、低空 `0x7fb4ec`、高空 `0x3d7bd5`、天顶 `0x296bc7`、辉光 `0xfff1d8`、太阳 `0xfff7e6`、强度 `2.2` 和太阳大小 `5`，并保留默认半径 `420` 与 `48` 段。场景销毁时会释放模型、天空穹顶以及卸载后才完成的异步加载。

拖动水面可产生涟漪；在水池外拖动可旋转相机。

## 不规则水池

<WaterPoolIrregularDemo />

::: details 点击我查看形状水池设置

```vue
<tv-water-pool :shape="TUB_OUTLINE" :scale="0.536 * 1.7" :position="[0, 0.33 * 1.7, 0]" />

<script lang="ts" setup>
const TUB_OUTLINE: [number, number][] = [
  [-1, 0],
  [-0.987, -0.106],
  [-0.945, -0.207],
  [-0.879, -0.291],
  [-0.795, -0.358],
  [-0.694, -0.399],
  [-0.588, -0.412],
  [0.513, -0.412],
  [0.619, -0.399],
  [0.72, -0.358],
  [0.804, -0.291],
  [0.871, -0.207],
  [0.981, -0.028],
  [0.981, 0.028],
  [0.871, 0.207],
  [0.804, 0.291],
  [0.72, 0.358],
  [0.619, 0.399],
  [0.513, 0.412],
  [-0.588, 0.412],
  [-0.694, 0.399],
  [-0.795, 0.358],
  [-0.879, 0.291],
  [-0.945, 0.207],
  [-0.987, 0.106]
]
</script>
```

:::

相机位置为 `[1.7, 1.35, 1.9]`，目标为 `[0, 0.3, 0]`，背景为 `rgb(40, 42, 54)`，并禁用坐标轴和网格辅助器。此示例使用与默认水池相同的太阳方向和 `SkyDome` 配置。在不使用 Draco 的情况下加载 `/models/bathtub.glb`，统一缩放为 `1.7`，位置为 `[-0.595 * 1.7, 0, 0.28 * 1.7]`。

## 属性

| 属性        | 类型                                        | 默认值                              | 说明                                                      |
| ----------- | ------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| resolution  | number                                      | `128`                               | `可选` 每轴高度场网格数量，限制在 8–512。                 |
| shape       | 'box' \| WaterPoolOutline \| BufferGeometry | `WATER_POOL_IRREGULAR_CUBE_OUTLINE` | `可选` 内置方形、自定义凸轮廓，或投影到 XZ 平面的几何体。 |
| segments    | number                                      | `160`                               | `可选` 沿解析后水池轮廓的细分数。                         |
| autoRipples | boolean                                     | `true`                              | `可选` 每 1.8 秒自动产生一个随机涟漪。                    |
| interactive | boolean                                     | `true`                              | `可选` 允许拖动水面产生水滴。                             |
| position    | Vector3 \| [number, number, number]         | `[0, 0, 0]`                         | `可选` 水面中心的世界坐标。                               |
| scale       | number                                      | `1`                                 | `可选` 同时应用于水池轮廓与深度的正数统一缩放。           |

```ts
type WaterPoolOutline = readonly (readonly [number, number])[]
```

`shape="box"` 解析为 `WATER_POOL_BOX_OUTLINE`，即 `x`、`z` 范围为 `-1` 到 `1` 的方形。默认 `WATER_POOL_IRREGULAR_CUBE_OUTLINE` 是倾斜四边形。自定义轮廓与几何体顶点会简化为凸包并移除共线点；结果必须包含原点且保持在 `-1…1` 范围内。两个内置轮廓均可从库中导入复用。

组件通过 `globalParameterBus` 获取太阳方向，不再提供本地扩展的显式太阳、方块、天空、曲率或边缘宽度属性。指针射线与水滴会转换到水池局部坐标，因此修改 `position` 和 `scale` 后，交互仍与水面保持一致。

## 实现原理

- CPU 高度场按网格保存 `(高度, 速度, 法线.x, 法线.z)`，并运行两次波动方程迭代。数据以 RGBA 半浮点 `DataTexture` 上传，在顶点节点中位移水面。
- 焦散贴图将水面网格沿折射后的太阳光线投影到池底。投影的局部压缩会把光线聚集成动态焦散。
- 单一水面在 TSL 中使用解析射线追踪，反射与折射瓷砖池壁、池底和程序化天空。
- 拖动水面会向高度场添加水滴，产生扩散的波纹，同时保留水池外的轨道控制器交互。
- 模拟使用固定 1/60 秒的时间累加器，每帧最多补算三步，因此涟漪在不同刷新率下表现一致。

瓷砖贴图在 canvas 中生成，因此组件本身不会下载任何资源。这些示例中的 GLB 仅用于演示场景。重建和卸载时，旧几何体、材质、纹理、监听器、动画回调与订阅都会被释放。

## 渲染器支持

所有着色均使用 TSL 节点材质，两种渲染器均可运行：

- **WebGPU** 通过 `WebGPURenderer` 直接执行节点图。
- **WebGL** 通过 `WebGLNodesHandler` 将同一份 TSL 节点图编译为 GLSL。
