---
lang: zh-CN
title: GeoObject 地理对象
---

::: tip 类型
组件
:::

## 默认用法

`GeoObject` 将一个 `Object3D` 锚定到地理坐标上。不传 `object` 时，组件会创建一个空的 `THREE.Group` 并通过 `onReady` 交给你，你可以在其中添加标记、标签或已加载的模型。更新 `coordinate` 或 `datum` 时会直接移动物体，不会重新构建。

<GeoObjectDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  >
    <GeoObject
      v-for="(marker, index) in MARKERS"
      :key="index"
      :coordinate="marker"
      datum="GCJ02"
      :object="anchors[index]"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

// Scene 原点使用 WGS84；标记点使用高德/腾讯等服务返回的 GCJ02 坐标。
const ORIGIN: GeoPoint = { lng: 116.391, lat: 39.907 }
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }
const MARKERS: GeoPoint[] = [
  { lng: 116.397428, lat: 39.90923 },
  { lng: 116.4005, lat: 39.9117 },
  { lng: 116.3945, lat: 39.912 }
]

// 锚点统一在 scene 的 created 回调中创建，绝不在模块作用域创建。
const anchors = shallowRef<THREE.Object3D[]>([])

const created = (scene, { camera }) => {
  // 从南侧抬高的视角向北俯视标记点。
  scene.setPosition(camera, { x: 0, y: 750, z: 1000 })
  camera.lookAt(0, 0, 0)

  anchors.value = MARKERS.map(() => {
    const anchor = new THREE.Group()
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(40, 120, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    )
    cone.position.y = 60
    anchor.add(cone)
    return anchor
  })
}

onBeforeUnmount(() => {
  // 外部传入的对象由示例自行释放。
  anchors.value.forEach((anchor) => {
    anchor.removeFromParent()
    anchor.traverse((child) => {
      const mesh = child as THREE.Mesh
      mesh.geometry?.dispose()
      ;(mesh.material as THREE.Material | undefined)?.dispose()
    })
  })
  anchors.value = []
})
</script>
```

:::

## 锚定已有对象

传入自己的 `Object3D` 时，对象的归属仍属于调用方：组件会把它重新挂到 Scene 下，卸载时再恢复到原来的父节点。

```vue
<script lang="ts" setup>
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

const coordinate: GeoPoint = { lng: 116.397, lat: 39.909 }
const model = new THREE.Group()
</script>

<template>
  <GeoObject :coordinate="coordinate" :object="model" />
</template>
```

## Props

| 名称 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| coordinate | GeoPoint | — | 地理锚点，采用 `datum` 声明的基准面 |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | Scene 的 datum | `coordinate` 所使用的基准面 |
| object | THREE.Object3D | 自动创建 Group | 要锚定的已有对象 |
| onReady | (object: THREE.Object3D) => void | — | 对象就绪后回调一次 |
| scene | THREE.Scene | 上下文中的 scene | 非 Scene 用法下显式指定场景 |

## 事件

| 名称 | 参数 | 描述 |
|------|------|------|
| onReady | (object: THREE.Object3D) => void | 对象被添加到场景并完成定位后触发 |
