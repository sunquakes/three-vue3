---
lang: zh-CN
title: 高度雾
---

::: tip type
Component
:::

`<tv-height-fog>` 是一个屏幕空间后处理特效。场景会先渲染到带深度纹理的半浮点渲染目标，然后用一个全屏四边形根据深度缓冲重建每个片元的世界坐标，合成带流动噪声和方向性内散射的指数高度雾。

由于高度雾接管了渲染帧，请不要在同一个场景中同时使用 `<tv-bloom>`。

该特效在 `WebGPURenderer`（默认）与传统的 `WebGLRenderer` 上都能运行；给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

## 默认用法

<HeightFogDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :grid-helper="gridHelper"
    @created="created"
  >
    <tv-height-fog />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

// 向远处延伸的柱子：[x, z, 宽度, 高度]。
const pillars: [number, number, number, number][] = [
  [-5, 5, 2.8, 13],
  [6, 2, 3.2, 17],
  [-2, -4, 2.6, 11],
  [8, -9, 3.4, 21],
  [-9, -15, 3.0, 15],
  [3, -22, 2.8, 19],
  [-6, -30, 3.4, 23]
]

const gridHelper = {
  size: 400,
  divisions: 40,
  colorGrid: 0x3a4050,
  colorCenterLine: 0x4d5570,
  y: 0.02
}

const meshes: THREE.Mesh[] = []

const created = (scene, { camera }) => {
  camera.position.set(0, 5, 14)
  camera.lookAt(0, 7, -12)

  // 与原 lightAzimuth 30° / lightElevation 25° 相同的方向。
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.453, 0.423, 0.785))

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x5c6579, roughness: 0.85 })
  const columns = pillars.map(([x, z, width, height]) => {
    const column = new THREE.Mesh(geometry, material)
    column.position.set(x, height / 2, z)
    column.scale.set(width, height, width)
    return column
  })

  meshes.push(ground, ...columns)
  scene.add(...meshes)
}

onBeforeUnmount(() => {
  meshes.forEach((mesh) => {
    mesh.parent?.remove(mesh)
    mesh.geometry.dispose()
    const meshMaterial = mesh.material as THREE.Material
    meshMaterial.dispose()
  })
  meshes.length = 0
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

## 属性

### 雾体

| 名称             | 类型                      | 默认值     | 描述                                        |
| ---------------- | ------------------------- | ---------- | ------------------------------------------- |
| fogColor         | string \| number \| Color | `'#c9d4cc'` | `可选` 雾的颜色。                            |
| fogDensity       | number                    | `0.02`     | `可选` 雾平面处的雾浓度。                    |
| fogHeight        | number                    | `10`       | `可选` 雾平面的世界高度。                    |
| fogHeightFalloff | number                    | `0.25`     | `可选` 每升高 `1 / falloff` 单位密度减半。   |
| fogMaxOpacity    | number                    | `1`        | `可选` 雾能够遮挡场景的最大不透明度。        |
| fogStartDistance | number                    | `0`        | `可选` 从相机多远处开始累积雾。              |

### 流动噪声

| 名称          | 类型   | 默认值  | 描述                              |
| ------------- | ------ | ------- | --------------------------------- |
| noiseStrength | number | `0`     | `可选` 雾平面的垂直位移（0 为关闭）。 |
| noiseScale    | number | `0.012` | `可选` 噪声图案的世界单位缩放。     |
| noiseSpeedX   | number | `0`     | `可选` 噪声沿 X 轴的流动速度。      |
| noiseSpeedZ   | number | `0`     | `可选` 噪声沿 Z 轴的流动速度。      |

### 方向性内散射

| 名称                      | 类型                      | 默认值     | 描述                              |
| ------------------------- | ------------------------- | ---------- | --------------------------------- |
| inscatteringColor         | string \| number \| Color | `'#ffe2b0'` | `可选` 内散射光的颜色。            |
| inscatteringIntensity     | number                    | `1`        | `可选` 内散射强度。                |
| inscatteringExponent      | number                    | `5`        | `可选` 光照方向附近的衰减锐度。    |
| inscatteringStartDistance | number                    | `0`        | `可选` 从相机多远处开始内散射。    |

光方向不是属性而是共享参数：雾会跟随存储在[参数总线](./parameter-bus)中的太阳方向，从而与天空保持一致。

```ts
globalParameterBus.set('sunDirection', new THREE.Vector3(0.453, 0.423, 0.785))
```
