---
lang: zh-CN
title: 瓦片图层
---

::: tip 类型
组件
:::

## 默认用法

`TileLayer` 将标准 XYZ / 滑图瓦片（256 px、Web Mercator，OpenStreetMap、高德和天地图使用的方案）投影到 Scene 的 `GeoReference` 所定义的平坦地面。

- 通过 `url` 模板传入瓦片源，支持 `{z}`、`{x}`、`{y}` 以及可选的 `{s}` 子域占位符。
- 默认情况下图层跟随相机：每帧把相机视锥投影到地面得到的可见矩形按给定 `zoom` 铺满瓦片，因此底图始终覆盖整个视口；平移、缩放或旋转时会自动加载/释放瓦片。额外的 `padding` 圈瓦片保证移动过程中地图不断裂。
- 若需要固定底图，可传入其必须覆盖的地理角点 `points`（并设置 `:follow-camera="false"`），此时会一次性请求包围矩形内的所有瓦片。
- 瓦片按需加载并淡入；材质为普通 `MeshBasicMaterial`，因此同时支持 WebGPU 与 WebGL 渲染器。
- 将一个 `GeoObject` 锚定到 WGS84（GPS 标准）坐标即可在地图上放置标记。

瓦片影像的基准面必须与 `datum` 一致（静态模式下还包括覆盖点 `points` 的基准面）。OSM 影像以 WGS84 索引，因此使用 Scene 的默认基准面即可。

<TileLayerDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="false"
    @created="created"
  >
    <TileLayer :url="TILE_URL" :zoom="TILE_ZOOM" datum="WGS84" />
    <GeoObject :coordinate="PIN" datum="WGS84" :object="pinAnchor" />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject, TileLayer } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

// 苏州附近的 WGS84（GPS 标准）点，同时作为局部原点与标记锚点。
const PIN: GeoPoint = { lng: 120.60682, lat: 31.330898 }
const ORIGIN = PIN

// OpenStreetMap 标准瓦片以 WGS84 索引。
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ZOOM = 15

// 标记锚点在 scene 的 created 回调中创建。
const pinAnchor = shallowRef<THREE.Object3D>()

const created = (scene, { camera }) => {
  // 固定的南侧视角让栅格地图保持正北朝上、便于阅读。
  scene.setPosition(camera, { x: 0, y: 600, z: 850 })
  camera.lookAt(0, 0, 0)

  const anchor = new THREE.Group()
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(40, 120, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
  )
  // 抬高圆锥，使其底面落在地面上。
  cone.position.y = 60
  anchor.add(cone)
  pinAnchor.value = anchor
}

onBeforeUnmount(() => {
  const anchor = pinAnchor.value
  if (!anchor) return
  anchor.removeFromParent()
  anchor.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    ;(mesh.material as THREE.Material | undefined)?.dispose()
  })
  pinAnchor.value = undefined
})
</script>
```

:::

## GCJ02 影像

高德（Gaode）、腾讯等国内地图服务以 GCJ02 坐标发布瓦片。设置 `datum="GCJ02"`（静态 `points` 模式下同时传入 GCJ02 坐标的覆盖点）。瓦片选择与角点投影因此使用同一基准面，GCJ02 的非线性偏移会被每个瓦片角点吸收，相邻瓦片保持无缝。`{s}` 占位符可通过 `subdomains` 自定义。

```vue
<TileLayer :url="AMAP_URL" :zoom="15" datum="GCJ02" />
```

## Props

| 名称 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| url | string | — | 瓦片 URL 模板，支持 `{z}`、`{x}`、`{y}` 与可选 `{s}` |
| zoom | number | — | 滑图缩放级别（非负整数） |
| followCamera | boolean | true | 相机每次移动都重新铺满可见地面矩形；为 false 时由 `points` 定义固定覆盖范围 |
| points | GeoPoint[] | — | `followCamera` 为 false 时使用的静态覆盖角点（采用 `datum` 基准面） |
| padding | number | 1 | 在可见矩形之外额外加载的瓦片圈数，保证平移时地图不断裂 |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | Scene 的 datum | 瓦片影像（静态模式下还有 `points`）所使用的基准面 |
| subdomains | string[] | `['a','b','c']` | `{s}` 占位符循环使用的值 |
| opacity | number | 1 | 瓦片影像透明度 |
| y | number | 0.05 | 地面四边形所在的局部米制高度 |
| fog | boolean | true | 与瓦片覆盖边缘锚定的距离雾，以及随背景色着色的底面，使地图在斜视时自然融入背景而不是出现硬边 |
| groundColor | number \| string | Scene 的 `bgColor`，否则 `#1a1a2e` | 距离雾与底面的颜色 |
| maxTiles | number | 256 | 保留瓦片数上限；跟随相机时保留最近的瓦片，静态模式超出会抛错 |
| maxPolarAngle | number | `PI/3`（60°） | 跟随相机时允许的 OrbitControls 最大极角；已有更严格限制时保持不变，卸载时恢复原值 |
| onReady | (group: THREE.Group) => void | — | 所有瓦片网格创建完成后触发 |
| onTileError | (index: TileIndex, url: string) => void | — | 单张瓦片下载失败时触发；该瓦片保持隐藏 |
| scene | THREE.Scene | 上下文中的 scene | 非 Scene 用法下显式指定场景 |

## 瓦片数学工具

底层的滑图瓦片函数也已导出，便于自定义瓦片工作流。

| 名称 | 参数 | 描述 |
|------|------|------|
| TILE_SIZE | — | 标准瓦片边长（像素，256） |
| lngLatToTile | (lng: number, lat: number, zoom: number) => TileIndex | 坐标所在的瓦片行列；经度在日期变更线处环绕，纬度截断到 ±85.05112878 |
| tileToLngLatBounds | (index: TileIndex) => TileBounds | 瓦片的地理西/北/东/南边界（度） |
| tileToCorners | (index: TileIndex) => TileCorners | 瓦片的西北/东北/东南/西南角坐标 |
| selectTiles | (points: GeoPoint[], zoom: number) => TileIndex[] | 点集包围矩形内的所有瓦片 |
| selectTilesInBounds | (west: number, south: number, east: number, north: number, zoom: number, padding?: number) => TileIndex[] | 西/南/东/北矩形内的所有瓦片，按 `padding` 圈扩展；跨日期变更线安全 |
| tileUrl | (template: string, index: TileIndex, subdomains?: string[]) => string | 展开 `{s}`/`{z}`/`{x}`/`{y}` 占位符 |

## 事件

| 名称 | 参数 | 描述 |
|------|------|------|
| onReady | (group: THREE.Group) => void | 图层组加入场景后触发一次 |
| onTileError | (index: TileIndex, url: string) => void | 单张瓦片下载失败时触发 |
