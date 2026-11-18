---
lang: zh-CN
title: 相机自适应
---

::: tip 类型
类 / 函数
:::

`FitCamera` 是一个带有自适应取景方法的 `THREE.PerspectiveCamera`，同样的能力也以普通函数形式导出。它们会根据内容的包围盒计算相机距离，因此无需为特定模型尺寸硬编码视点或远裁剪面。

## 默认用法

<FitCameraDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" :camera="camera" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { FitCamera } from 'three-vue3'

const camera = new FitCamera(45, 1, 0.1, 2000)

const created = (scene, { controls }) => {
  const group = new THREE.Group()
  const geometry = new THREE.SphereGeometry(0.4, 16, 16)
  const material = new THREE.MeshLambertMaterial({ color: 0xff7a45 })

  for (let i = 0; i < 12; i++) {
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(Math.cos(i) * 6, (i % 3) - 1, Math.sin(i) * 6)
    group.add(sphere)
  }

  scene.add(group)

  // 一次调用即可让全部对象进入视野。
  if (controls) camera.bind(controls).fitToObject(group)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## 函数

类的各个方法都委托给以下函数，它们接受任意 `THREE.PerspectiveCamera`。

```ts
import { fitCameraToBox, fitCameraToObject, fitCameraToPoints } from 'three-vue3'

fitCameraToObject(camera, model, { elevation: Math.PI / 6, padding: 1.6 })
```

## 选项

| 名称       | 类型                  | 默认值   | 描述                                                     |
| ---------- | --------------------- | -------- | -------------------------------------------------------- |
| elevation  | number                | `PI / 4` | `可选` 相对水平面的俯仰角（弧度）。                      |
| azimuth    | number                | `PI / 4` | `可选` 围绕目标点的水平方位角，从 -Z 轴顺时针计算。      |
| padding    | number                | `1.4`    | `可选` 距离倍数，`> 1` 会向外拉远以留出边距。            |
| distance   | number                |          | `可选` 直接指定距离（世界单位），覆盖计算结果。          |
| adjustClip | boolean               | `true`   | `可选` 根据内容尺寸自动推导 `near` / `far`。             |
| controls   | OrbitControls \| null | `null`   | `可选` 传入后会把它的 `target` 同步到包围盒中心。        |

## 方法

| 名称        | 参数                                                                | 描述                     |
| ----------- | ------------------------------------------------------------------- | ------------------------ |
| bind        | (controls?: OrbitControls \| null) => this                          | 绑定后续取景使用的控制器。 |
| fitToPoints | (points: LocalPoint[], options?: CameraFitOptions) => this          | 让一组局部坐标点进入视野。 |
| fitToObject | (object: Object3D \| Object3D[], options?: CameraFitOptions) => this | 让对象的世界包围盒进入视野。 |
| fitToBox    | (box: THREE.Box3, options?: CameraFitOptions) => this               | 让指定的世界包围盒进入视野。 |
