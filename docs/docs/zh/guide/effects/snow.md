---
lang: zh-CN
title: 雪
---

::: tip 类型
组件
:::

`<tv-snow>` 在 `<tv-scene>` 中渲染 GPU 雪花场。每片雪花都是柔和的雪花精灵，下落时按各自的相位摇摆，并在围绕相机的盒体内循环。启用 `accumulate` 后，雪会逐渐堆积在场景网格上。

着色器是 TSL 节点材质，因此在 `WebGPURenderer`（默认）和传统 `WebGLRenderer` 上都能渲染。给 `<tv-scene>` 加上 `renderer-type="webgl"` 即可对比两种后端。

不使用场景组件时，也可以直接使用 `SnowEffect` 类。

## 默认用法

<SnowDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-snow
      :count="1200"
      :speed="0.5"
      :color="0xffffff"
      :range="16"
      :height="14"
      :wind-x="0.2"
      :wind-z="0.08"
      accumulate
      :accumulation-thickness="0.12"
      :accumulation-duration="6"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const objects: THREE.Object3D[] = []

const created = (scene, { camera }) => {
  camera.position.set(0, 1.6, 6)
  camera.lookAt(0, -0.2, 0)

  // 几个简单网格给积雪提供落脚面。
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: '#39404f', roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -1.4

  const rock = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#4c566a', roughness: 0.85 })
  )
  rock.position.set(-1.6, -0.5, -0.4)
  rock.scale.set(1, 0.8, 1)

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: '#434c5e', roughness: 0.9 })
  )
  block.position.set(1.5, -0.65, -0.6)
  block.rotation.y = Math.PI / 6

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.6, 32),
    new THREE.MeshStandardMaterial({ color: '#3f4657', roughness: 0.9 })
  )
  pillar.position.set(0.2, -0.6, -1.8)

  scene.add(ground, rock, block, pillar)
  objects.push(ground, rock, block, pillar)
}

onBeforeUnmount(() => {
  objects.forEach((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    mesh.removeFromParent()
  })
  objects.length = 0
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

| 名称                  | 类型                      | 默认值     | 描述                                  |
| --------------------- | ------------------------- | ---------- | ------------------------------------- |
| count                 | number                    | `3000`     | `可选` 雪花数量。                     |
| color                 | string \| number \| Color | `0xffffff` | `可选` 雪花颜色。                     |
| speed                 | number                    | `0.5`      | `可选` 下落速度系数。                 |
| range                 | number                    | `20`       | `可选` 循环盒体的水平尺寸。           |
| height                | number                    | `15`       | `可选` 循环盒体的垂直尺寸。           |
| windX                 | number                    | `0.2`      | `可选` X 轴风力漂移。                 |
| windZ                 | number                    | `0.1`      | `可选` Z 轴风力漂移。                 |
| turbulence            | number                    | `0.8`      | `可选` 阵风摇摆强度。                 |
| opacity               | number                    | `0.9`      | `可选` 雪花不透明度。                 |
| size                  | number                    | `1`        | `可选` 雪花尺寸系数。                 |
| accumulate            | boolean                   | `false`    | `可选` 让雪堆积在场景网格上。         |
| accumulationTargets   | Object3D \| Object3D[]    | -          | `可选` 承接积雪的网格，默认整个场景。 |
| accumulationThickness | number                    | `0.1`      | `可选` 积雪层的厚度。                 |
| accumulationDuration  | number                    | `6`        | `可选` 积雪达到最厚的秒数。           |
| accumulationColor     | string \| number \| Color | `0xffffff` | `可选` 积雪颜色。                     |

## 类用法

独立的 `SnowEffect` 使用与 `<tv-snow>` 相同的雪花精灵、阵风、循环、柔和淡出和可选积雪能力。它可在 WebGPU 与 WebGL 上运行，加入场景后会自动跟随相机并推进自身时钟。

```ts
import { SnowEffect } from 'three-vue3'

const snow = new SnowEffect({
  count: 1200,
  size: 1,
  accumulate: true,
  accumulationDuration: 6
})
scene.add(snow.mesh)

// 无需逐帧更新。仅在需要手动驱动时间轴时调用 update(delta)，销毁时：
snow.dispose()
```

默认会在场景中所有符合条件的不透明网格上积雪。可通过 `accumulationTargets` 限定目标；`accumulationThickness`、`accumulationDuration` 和 `accumulationColor` 与组件同名属性一致。
