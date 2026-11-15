---
lang: zh-CN
title: 地理参考系
---

::: tip 类型
类 + Scene 配置项
:::

## 概念

`GeoReference` 将坐标参考系、大地基准面和轴约定绑定到一个固定的**局部原点**。转换链路如下：

```text
地理坐标 (lng, lat, alt)
  -> 基准面归一化到 WGS84
  -> 局部切平面（float64 米制）
  -> 围绕局部原点重新中心化
  -> ENU -> three.js 轴映射（东:+X，北:-Z，上:+Y）
  -> THREE.Vector3（float32）
```

局部原点保证了场景坐标始终很小。Web Mercator 的绝对坐标约为 1.3e7 米，直接使用 three.js 的 float32 坐标在城市场景中会产生明显抖动；重新中心化后，所有物体都位于距 `(0, 0, 0)` 几公里以内。

每个 Scene 都存在一个 `GeoReference`。不传入任何 GIS 配置时，它使用以 `(0, 0)` 为中心的 WGS84/等距圆柱默认值，对普通的非地理场景是完全无副作用的空操作，因此该功能是完全可选的。

## 默认用法

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

const ORIGIN: GeoPoint = { lng: 116.391, lat: 39.907 }
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }
const MARKERS: GeoPoint[] = [
  { lng: 116.397428, lat: 39.90923 },
  { lng: 116.4005, lat: 39.9117 },
  { lng: 116.3945, lat: 39.912 }
]

const anchors = shallowRef<THREE.Object3D[]>([])

const created = (scene, { camera }) => {
  // scene 直接识别局部米制视点，并自行投影地理坐标。
  scene.setPosition(camera, { x: 0, y: 750, z: 1000 })
  camera.lookAt(0, 0, 0)

  // 所有物体都在 created 回调中创建，GeoObject 再通过 scene 自身的参考系投影定位。
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

## Scene 配置项

| 属性 | 类型 | 默认值 | 描述 |
| ---- | ---- | ------ | ---- |
| origin | GeoPoint | `{ lng: 0, lat: 0, alt: 0 }` | 局部切平面原点，所有场景坐标都相对于它 |
| crs | `'EPSG:4326' \| 'EPSG:3857'` | `'EPSG:4326'` | 平面模型：等距圆柱切平面或重新中心化的 Web Mercator |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | `'WGS84'` | 传入场景的坐标所使用的基准面 |
| axes | AxesMapping | `{ east: 'x', north: '-z', up: 'y' }` | 将 ENU 基映射到带符号的 three.js 轴 |
| geo | GeoReference | — | 直接传入预先构建的参考系，替代 `origin`/`crs`/`datum`/`axes` |

Scene 构建出的参考系可在 `created` 回调中通过 `components.geo` 获取，也可通过 `useScene().geo` 获取。它同时会绑定到 scene 自身，因此大多数代码完全不需要显式提到 `geo`。

## 物体定位

每个 Scene 都会把自己的 `GeoReference` 绑定到 scene 实例上，并安装一个统一的定位方法 `scene.setPosition(object, position, datum?)`。由于 scene 已经持有参考系，定位时只需给出坐标本身，无需再把参考系传来传去；mesh、group 和 camera 都是 `THREE.Object3D`，所以同一个调用写法可以定位任意对象。

`position` 接受所有常用形态（`ScenePosition`）：

| 坐标形态 | 含义 |
| --- | --- |
| `{ lng, lat, alt? }` | 地理点，经 scene 参考系投影 |
| `[lng, lat]` | 地理点元组，高度默认 `0` |
| `[lng, lat, alt]` | 地理点元组 |
| `THREE.Vector3` | 局部米坐标，原样使用、不投影 |
| `{ x, y, z? }` | 局部米坐标对象，`z` 默认 `0` |

```ts
const created = (scene) => {
  // 下面四种都是地理坐标，统一经由 scene 自身的参考系投影。
  scene.setPosition(mesh, { lng: 116.397, lat: 39.909 })
  scene.setPosition(mesh, { lng: 116.397, lat: 39.909, alt: 35 })
  scene.setPosition(mesh, [116.397, 39.909])
  scene.setPosition(mesh, [116.397, 39.909, 35])

  // GCJ02/BD09 输入可按次传入 datum 覆盖场景的 datum。
  scene.setPosition(mesh, [116.403, 39.915], 'GCJ02')

  // 相机与 mesh 使用完全相同的调用。
  scene.setPosition(camera, [116.397428, 39.90923, 120])

  // 局部米坐标原样使用，不做投影。
  scene.setPosition(helper, new THREE.Vector3(10, 0, -5))
  scene.setPosition(helper, { x: 10, y: 0, z: -5 })
}
```

方法会返回传入的对象，支持链式调用。自行 `new THREE.Scene()` 创建的场景没有该方法；可调用一次 `bindSceneGeo(scene, geo)` 安装，或通过 `getSceneGeo(scene)` 读取参考系。如果场景已安装方法但没有绑定参考系，地理元组/对象会回退为本地坐标，把 `lng/lat/alt` 直接写到 `x/y/z`，因此该调用在任何场景下都是安全的。

| 辅助函数 | 签名 | 描述 |
| --- | --- | --- |
| scene.setPosition | (object: Object3D, position: ScenePosition, datum?: DatumType) => Object3D | 定位任意对象；地理输入自动投影，局部米坐标原样使用 |
| scene.getGeo | () => GeoReference \| undefined | 读取绑定在 scene 上的参考系 |
| bindSceneGeo | (scene: Scene, geo?: GeoReference) => Scene | 在 scene 上安装定位方法，并可选绑定参考系 |
| getSceneGeo | (scene: Scene) => GeoReference \| undefined | `scene.getGeo()` 的函数形式 |
| ensureSceneGeo | (scene: Scene) => Scene | 为缺少定位方法的 scene 补装该方法 |

## GeoReference 方法

| 名称 | 参数 | 描述 |
| ---- | ---- | ---- |
| constructor | (origin?: GeoPoint, options?: GeoReferenceOptions) => GeoReference | 构建参考系及其切平面 |
| toLocal | (p: GeoPoint, datum?: DatumType, target?: Vector3) => Vector3 | 地理坐标 -> 局部米制坐标 |
| toGeo | (v: Vector3, datum?: DatumType, target?: GeoPoint) => GeoPoint | 局部米制坐标 -> 地理坐标 |
| setPosition | (object: Object3D, p: GeoPoint, datum?: DatumType) => Object3D | 将已有物体放置到指定地理位置 |
| distance | (a: GeoPoint, b: GeoPoint, datum?: DatumType) => number | 平面距离（米） |

```ts
import { GeoReference } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

const origin: GeoPoint = { lng: 116.397, lat: 39.909 }
const geo = new GeoReference(origin, { crs: 'EPSG:4326', datum: 'WGS84' })

// 相对于原点的局部米制坐标（内部使用 float64 计算）。
const local = geo.toLocal({ lng: 116.4005, lat: 39.909 })

// 反向转换；混合多种数据源时可按次传入 datum。
const back = geo.toGeo(local)

// GCJ02（高德/腾讯）输入会被自动归一化。
const fromMars = geo.toLocal({ lng: 116.403, lat: 39.915 }, 'GCJ02')
```

## 基准面工具函数

国内地图服务使用加密基准面；若不转换就与原始 GPS（WGS84）数据混用，在中国境内会产生 50–600 米的偏移。

| 函数 | 签名 | 描述 |
| ---- | ---- | ---- |
| toWGS84 | (p: GeoPoint, from: DatumType) => GeoPoint | 将 GCJ02/BD09 转为 WGS84 |
| fromWGS84 | (p: GeoPoint, to: DatumType) => GeoPoint | 将 WGS84 转为 GCJ02/BD09 |
| convertDatum | (p: GeoPoint, from: DatumType, to: DatumType) => GeoPoint | 任意基准面之间互转 |
| wgs84ToGcj02 / gcj02ToWgs84 | (p: GeoPoint) => GeoPoint | WGS84 与 GCJ02 直接互转 |
| gcj02ToBd09 / bd09ToGcj02 | (p: GeoPoint) => GeoPoint | GCJ02 与 BD09 直接互转 |

GCJ02 -> WGS84 的反解采用定点迭代；BD09 闭式反解存在几厘米的固有残差。

## 投影工具函数

| 函数 | 描述 |
| ---- | ---- |
| mercatorProject(p) | EPSG:4326 经纬度 -> EPSG:3857 Web Mercator 米 |
| mercatorUnproject(v) | EPSG:3857 米 -> EPSG:4326 经纬度 |
| createLocalPlane(code, origin) | 为任一 CRS 构建重新中心化的 `LocalPlane` |
