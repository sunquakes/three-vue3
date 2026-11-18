---
lang: en-US
title: Water
---

::: tip type
Component
:::

`<tv-water>` renders a cinematic shallow ocean surface inside a `<tv-scene>`. This is a port of [Evan Wallace's webgl-water](https://madebyevan.com/webgl-water/) and the `Water` component from [react-three-lite](https://github.com/sunquakes/react-three-lite), extended with a multi-wave Gerstner-style spectrum, planar reflection and refraction, and custom surface outlines.

A displaced 420 m plane is driven by a 14-wave spectrum plus fractal noise. The same CPU sampler is shared with the rain collision height map, so `height-map` raindrops land exactly on the animated surface.

Everything is a TSL node material, so it renders on `WebGPURenderer` (the default) and on a classic `WebGLRenderer` through `WebGLNodesHandler`. Add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

## Default Usage

<WaterDemo />

::: details Click me to view the code

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-water />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
  globalParameterBus.set('sunDirection', new THREE.Vector3(-0.58, 0.1, -0.81))
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

Set `globalParameterBus` before `<tv-water>` initializes so the water and the rest of the scene use the same sun direction. The water subscribes to later direction updates until it is disposed.

## Custom Shape

Pass a convex `[x, z]` outline, or a `BufferGeometry` whose vertices can be projected onto the XZ plane, to triangulate an irregular surface.

<WaterShapeDemo />

::: details Click me to view the code

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water :shape="LAKE_OUTLINE" :segments="160" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const LAKE_OUTLINE: [number, number][] = [
  [-8, -2.5],
  [-4.5, -5.5],
  [1.5, -6],
  [6.5, -3.5],
  [8, 1],
  [4.5, 5],
  [-1.5, 5.5],
  [-6.5, 3]
]

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  if (!camera) return
  camera.position.set(0, 6, 15)
  if (controls) controls.target.set(0, 0, 0)
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

## Props

| Name              | Type                                | Default     | Description                                                                                                                                      |
| ----------------- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| captureResolution | number                              | `512`       | `optional` Longest edge of the planar reflection and refraction captures, in device pixels. Clamped to 64–2048 and capped by the drawing buffer. |
| segments          | number                              | `240`       | `optional` Plane subdivisions per axis, clamped to 16–1024. With `shape`, this is the total boundary sampling budget.                            |
| size              | number                              | `420`       | `optional` Side length of the square water patch, in world units. Ignored when `shape` is provided.                                              |
| shape             | WaterPoolOutline \| BufferGeometry  | —           | `optional` Custom convex water outline or geometry projected onto XZ.                                                                            |
| position          | Vector3 \| [number, number, number] | `[0, 0, 0]` | `optional` World position of the water surface center.                                                                                           |

```ts
type WaterPoolOutline = readonly (readonly [number, number])[]
```

Custom points and geometry vertices are reduced to a convex hull, with collinear points removed. The hull must contain the origin and have at least three non-collinear points. Without `shape`, `segments` subdivides each axis of the `size × size` plane; with `shape`, it controls the total outline sampling budget. `position` moves both the mesh and its reflection plane, and underwater sampling remains relative to the positioned surface.

## Renderer Support

- **WebGPU** executes the TSL node graph directly with `WebGPURenderer`.
- **WebGL** compiles the same node graph to GLSL through `WebGLNodesHandler`.

Changing a prop rebuilds the mesh, geometry, textures, and render targets. Those resources, observers, animation callbacks, and the sun-direction subscription are disposed on replacement and when the component unmounts.
