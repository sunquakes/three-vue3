---
lang: en-US
title: Rain
---

::: tip type
Component
:::

`<tv-rain>` renders a GPU rain field inside a `<tv-scene>`. Each drop is a billboard quad stretched into a streak and wrapped in a box around the camera, so the rain follows the view without spawning new geometry, and every drop lands on the surface it hits.

The shader is a TSL node material, so it renders on `WebGPURenderer` (the default) and on a classic `WebGLRenderer` through `WebGLNodesHandler`. Add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

The same effect is available as the `RainEffect` class when you are not using the scene component.

## Default Usage

<RainDemo />

::: details Click me to view the codes

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

## Collision & Splash

Pass a grayscale `heightMap` and drops stop at the surface instead of falling through it. Each impact spawns an expanding ripple, so rain reads as hitting the ground. The map covers `heightMapSize` world units centred on the origin and is sampled like a plane's UVs (`u = x / size + 0.5`, `v = 0.5 - z / size`), so terrain displaced by the same image lines up exactly with the impacts.

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(28, 30, 40)" :axes-helper="false" @created="created">
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

  // Any grayscale image works; this one is generated to avoid assets.
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

  // Terrain displaced by the same map, so drops land on the visible surface.
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

Set `splash={false}` to keep the collision but skip the ripples, and use `splashColor`, `splashSize` and `splashDuration` to tune them.

## Props

| Name                | Type                     | Default        | Description                                                     |
| ------------------- | ------------------------ | -------------- | --------------------------------------------------------------- |
| count               | number                   | `4000`         | `optional` Number of raindrops.                                 |
| color               | string \| number \| Color | `0xb0c4de`    | `optional` Raindrop color.                                      |
| speed               | number                   | `1`            | `optional` Falling speed multiplier.                            |
| range               | number                   | `20`           | `optional` Horizontal distribution range.                       |
| height              | number                   | `15`           | `optional` Falling height range.                                |
| windX               | number                   | `0.1`          | `optional` Wind force on the X axis.                            |
| windZ               | number                   | `0`            | `optional` Wind force on the Z axis.                            |
| opacity             | number                   | `0.8`          | `optional` Raindrop opacity.                                    |
| heightMap           | string \| Texture        | -              | `optional` Grayscale height map the drops collide with.          |
| heightMapSize       | number                   | `range`        | `optional` World size covered by the height map.                |
| heightMapAmplitude  | number                   | `height * 0.4` | `optional` Vertical extent added by the height map.             |
| groundHeight        | number                   | `-height / 2`  | `optional` Base ground Y of the height map.                     |
| splash              | boolean                  | `true`         | `optional` Draw an expanding ripple where each drop lands.      |
| splashColor         | string \| number \| Color | `0xd6ecff`    | `optional` Ripple color.                                        |
| splashSize          | number                   | `0.9`          | `optional` World radius of a ripple at its widest.              |
| splashDuration      | number                   | `0.6`          | `optional` Ripple lifetime in seconds.                          |

## Class usage

The standalone `RainEffect` is a lightweight point cloud: drops fall and drift with the wind inside a box and wrap at the edges, without a height map or ground splashes.

```ts
import { RainEffect } from 'three-vue3'

const rain = new RainEffect({ count: 2000, speed: 20, wind: [2, 0] })
scene.add(rain.mesh)

// Inside the render loop:
rain.update(delta)

// On teardown:
rain.dispose()
```
