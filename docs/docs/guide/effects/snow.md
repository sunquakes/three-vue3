---
lang: en-US
title: Snow
---

::: tip type
Component
:::

`<tv-snow>` renders a GPU snow field inside a `<tv-scene>`. Every flake is a soft snowflake sprite that sways with a per-flake phase while falling, and wraps in a box around the camera. Add `accumulate` to let snow settle on the scene meshes.

The shader is a TSL node material, so it renders on `WebGPURenderer` (the default) and on a classic `WebGLRenderer`. Add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

The same effect is available as the `SnowEffect` class when you are not using the scene component.

## Default Usage

<SnowDemo />

::: details Click me to view the codes

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

  // A few simple meshes give the settling snow something to cover.
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

## Props

| Name                  | Type                     | Default    | Description                                                       |
| --------------------- | ------------------------ | ---------- | ----------------------------------------------------------------- |
| count                 | number                   | `3000`     | `optional` Number of flakes.                                      |
| color                 | string \| number \| Color | `0xffffff` | `optional` Flake color.                                           |
| speed                 | number                   | `0.5`      | `optional` Falling speed multiplier.                              |
| range                 | number                   | `20`       | `optional` Horizontal size of the wrapping box.                   |
| height                | number                   | `15`       | `optional` Vertical size of the wrapping box.                     |
| windX                 | number                   | `0.2`      | `optional` Wind drift on the X axis.                              |
| windZ                 | number                   | `0.1`      | `optional` Wind drift on the Z axis.                              |
| turbulence            | number                   | `0.8`      | `optional` Strength of the gusty sway.                            |
| opacity               | number                   | `0.9`      | `optional` Flake opacity.                                         |
| size                  | number                   | `1`        | `optional` Flake size multiplier.                                 |
| accumulate            | boolean                  | `false`    | `optional` Let snow settle on the scene meshes.                   |
| accumulationTargets   | Object3D \| Object3D[]   | -          | `optional` Meshes that collect snow; defaults to the whole scene. |
| accumulationThickness | number                   | `0.1`      | `optional` Thickness of the settled snow shell.                   |
| accumulationDuration  | number                   | `6`        | `optional` Seconds for the snow to reach full thickness.          |
| accumulationColor     | string \| number \| Color | `0xffffff` | `optional` Color of the settled snow.                             |

## Class usage

The standalone `SnowEffect` is a lightweight point cloud with the same TSL flake shading but no accumulation pass; it also runs on WebGPU and WebGL.

```ts
import { SnowEffect } from 'three-vue3'

const snow = new SnowEffect({ count: 1200, size: 10 })
scene.add(snow.mesh)

// Inside the render loop:
snow.update(delta)

// On teardown:
snow.dispose()
```
