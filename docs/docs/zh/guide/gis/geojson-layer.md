---
lang: zh-CN
title: GeoJsonLayer 图层
---

::: tip 类型
组件
:::

## 默认用法

`GeoJsonLayer` 在 Scene 的 `GeoReference` 中渲染 [GeoJSON](https://geojson.org/) 数据（`FeatureCollection`、`Feature` 或裸几何体）。支持的几何类型包括 `Point`、`MultiPoint`、`LineString`、`MultiLineString`、`Polygon` 和 `MultiPolygon`，并支持多边形孔洞。

- 点使用一次合并的 `LineSegments` 绘制调用渲染为菱形标记。
- 线使用 `LineSegments` 渲染为环。
- 多边形渲染为贴地填充（`ShapeGeometry`）；当 `extrudeHeight > 0` 时渲染为拉伸块（`ExtrudeGeometry`）。
- `featureStyle` 返回 `null` 时会完全跳过该要素。

<GeoJsonLayerDemo />

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
    <GeoJsonLayer
      :data="data"
      :style="{ strokeColor: 0x9fd0ff, pointColor: 0xffd166, pointSize: 40 }"
      :feature-style="featureStyle"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { GeoJsonLayer } from 'three-vue3'
import type { GeoJsonData, GeoJsonFeature, GeoJsonStyle } from 'three-vue3'

const ORIGIN = { lng: 116.397, lat: 39.909 }
const GRID = { size: 1200, divisions: 24, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }

const data: GeoJsonData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'park' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.395, 39.9095],
            [116.399, 39.9095],
            [116.399, 39.9115],
            [116.395, 39.9115],
            [116.395, 39.9095]
          ]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [116.397, 39.909]
      }
    }
  ]
}

const COLORS: Record<string, GeoJsonStyle> = {
  park: { fillColor: 0x4caf50, strokeColor: 0xb9f6ca, opacity: 0.7 }
}

const featureStyle = (feature: GeoJsonFeature): GeoJsonStyle | undefined => {
  const kind = feature.properties?.kind
  return typeof kind === 'string' ? COLORS[kind] : undefined
}

const created = (scene, { camera }) => {
  // 固定的南侧视角向北俯视数据集。
  scene.setPosition(camera, { x: 0, y: 500, z: 700 })
  camera.lookAt(0, 0, 0)
}
</script>
```

:::

## GCJ02 / BD09 数据

当数据本身经过加密（来自国内地图服务的瓦片或导出数据常见这种情况）时，给图层传入 `datum`，或在 Scene 上统一设置一次。坐标在投影前会自动归一化。

```vue
<GeoJsonLayer :data="amapData" datum="GCJ02" />
```

## Props

| 名称 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| data | GeoJsonData | — | FeatureCollection、Feature 或裸几何体对象 |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | Scene 的 datum | 要素坐标所使用的基准面 |
| style | GeoJsonStyle | 见下文 | 所有要素的基础样式 |
| featureStyle | (feature: GeoJsonFeature) => GeoJsonStyle \| null \| undefined | — | 逐要素样式覆盖；返回 `null` 跳过该要素 |
| onReady | (group: THREE.Group) => void | — | 图层构建完成并加入场景后触发 |
| scene | THREE.Scene | 上下文中的 scene | 非 Scene 用法下显式指定场景 |

## GeoJsonStyle

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| fillColor | ColorRepresentation | 0x4a90d9 | 多边形填充色 |
| strokeColor | ColorRepresentation | 0x9fd0ff | 多边形描边与线要素颜色 |
| pointColor | ColorRepresentation | 0xffd166 | 点标记颜色 |
| pointSize | number | 20 | 点标记的世界尺寸（米） |
| extrudeHeight | number | 0 | 多边形拉伸高度（米）；0 表示贴地渲染 |
| opacity | number | 0.85 | 填充透明度 |

## 事件

| 名称 | 参数 | 描述 |
|------|------|------|
| onReady | (group: THREE.Group) => void | 图层组加入场景后触发一次 |
