---
lang: zh-CN
title: 雨
---

::: tip 类型
组件
:::

`<tv-rain>` 在 `<tv-scene>` 中渲染 GPU 雨滴场。每个雨滴都是被拉伸为条纹的公告板四边形，在一个围绕相机的盒体内循环，因此雨效会跟随视角，且不会反复创建几何体；每颗雨滴都会落在它命中的表面上。

着色器是 TSL 节点材质，因此在 `WebGPURenderer`（默认）和经由 `WebGLNodesHandler` 的传统 `WebGLRenderer` 上都能渲染。给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

不使用场景组件时，也可以直接使用 `RainEffect` 类。

## 默认用法

<RainDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-rain :count="3000" :speed="0.8" :color="0x87ceeb" :range="30" :height="20" />
  </tv-scene>
</template>

<script lang="ts" setup>
const created = (_scene, { camera }) => {
  if (!camera) return
  camera.position.set(0, 0, 4)
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

## 碰撞与溅射

传入灰度 `heightMap` 后，雨滴会停在表面而不是穿透下去，每次落地都会生成一圈扩散的涟漪，让雨看起来真正打在表面上。贴图覆盖以原点为中心、边长为 `heightMapSize` 的世界范围，并按平面的 UV 采样（`u = x / size + 0.5`，`v = 0.5 - z / size`），所以用同一张图位移的地形与落点完全对齐。

实时示例生成确定性的 `256 × 256` 值噪声高度场，并将其同时用于地形位移、雨滴碰撞和涟漪。

<RainCollisionDemo />

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(28, 30, 40)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-rain
      v-if="heightMap"
      :count="5000"
      :range="SIZE"
      :height="HEIGHT"
      :height-map="heightMap"
      :height-map-size="SIZE"
      :height-map-amplitude="AMPLITUDE"
      :ground-height="GROUND_Y"
      :splash-size="1"
      :splash-duration="0.7"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { shallowRef } from 'vue'
import * as THREE from 'three'

const SIZE = 40
const HEIGHT = 24
const GROUND_Y = -HEIGHT / 2
const AMPLITUDE = HEIGHT * 0.4

const heightMap = shallowRef<THREE.CanvasTexture>()

const created = (scene, { camera, controls }) => {
  camera.position.set(0, 8, 27)
  controls.target.set(0, -3, 0)
  controls.update()

  // 任何灰度图都可以；这里用生成的方式避免依赖资源。
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(128, 128)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const value = (Math.sin(x / 11) * Math.cos(y / 13) * 0.5 + 0.5) * 255
      const i = (y * 128 + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  heightMap.value = texture

  // 用同一张图位移地形，让雨滴落在可见表面上。
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, 128, 128)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    const col = Math.round(uv.getX(i) * 127)
    const row = Math.round((1 - uv.getY(i)) * 127)
    position.setY(i, GROUND_Y + (image.data[(row * 128 + col) * 4] / 255) * AMPLITUDE)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  scene.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: '#39404f', roughness: 0.85 })
    )
  )
}
</script>
```

设置 `:splash="false"` 可保留碰撞但关闭涟漪，`splashColor`、`splashSize`、`splashDuration` 用于调整涟漪。

## 属性

| 名称               | 类型                     | 默认值         | 描述                                         |
| ------------------ | ------------------------ | -------------- | -------------------------------------------- |
| count              | number                   | `4000`         | `可选` 雨滴数量。                            |
| color              | string \| number \| Color | `0xb0c4de`    | `可选` 雨滴颜色。                            |
| speed              | number                   | `1`            | `可选` 下落速度系数。                        |
| range              | number                   | `20`           | `可选` 水平分布范围。                        |
| height             | number                   | `15`           | `可选` 下落高度范围。                        |
| windX              | number                   | `0.1`          | `可选` X 轴风力。                            |
| windZ              | number                   | `0`            | `可选` Z 轴风力。                            |
| opacity            | number                   | `0.8`          | `可选` 雨滴不透明度。                        |
| heightMap          | string \| Texture        | -              | `可选` 雨滴碰撞的灰度高度图。                |
| heightMapSize      | number                   | `range`        | `可选` 高度图覆盖的世界尺寸。                |
| heightMapAmplitude | number                   | `height * 0.4` | `可选` 高度图带来的垂直起伏范围。            |
| groundHeight       | number                   | `-height / 2`  | `可选` 高度图的基础地面 Y 值。               |
| splash             | boolean                  | `true`         | `可选` 在雨滴落点绘制扩散涟漪。              |
| splashColor        | string \| number \| Color | `0xd6ecff`    | `可选` 涟漪颜色。                            |
| splashSize         | number                   | `0.9`          | `可选` 涟漪最大时的世界半径。                |
| splashDuration     | number                   | `0.6`          | `可选` 涟漪存续秒数。                        |

## 类用法

独立的 `RainEffect` 是轻量的点云：雨滴在盒体内下落并随风漂移，到边界后循环，不包含高度图或地面溅射。

```ts
import { RainEffect } from 'three-vue3'

const rain = new RainEffect({ count: 2000, speed: 20, wind: [2, 0] })
scene.add(rain.mesh)

// 在渲染循环中：
rain.update(delta)

// 销毁时：
rain.dispose()
```
