---
lang: en-US
title: Water Pool
---

::: tip type
Component
:::

`<tv-water-pool>` renders an interactive, ray traced water pool inside a `<tv-scene>`. It is a port of [Evan Wallace's webgl-water](https://madebyevan.com/webgl-water/), with the sphere replaced by cubes of various shapes.

A CPU height field drives the ripples and the caustic light map, which are uploaded as data textures. Water, the irregular tiled basin and the floating boxes are shaded by analytic rays in the fragment shader, so both the WebGPU and the WebGL renderer show the same reflection, refraction and caustic result without extra passes.

## Default Usage

<WaterPoolDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water-pool />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  if (!camera) return
  camera.position.set(1.7, 1.65, 2.1)
  if (controls) controls.target.set(0, -0.3, 0)
  camera.lookAt(0, -0.3, 0)
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

Drag inside the pool to add ripples, drag a box to push it around, and drag outside the pool to orbit the camera.

## Props

| Name         | Type                                                                                                                   | Default         | Description                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| resolution   | number                                                                                                                 | `128`           | `optional` Height-field cells per axis, clamped to 8–512.         |
| segments     | number                                                                                                                 | `160`           | `optional` Subdivisions along the irregular pool outline.         |
| boxes        | `{ position: [number, number, number]; size: [number, number, number]; color?: string }[]`                             | Three cubes     | `optional` Cubes of different shapes floating in the pool.        |
| sunDirection | Vector3 \| [number, number, number]                                                                                    | `[0.55, 0.9, 0.35]` | `optional` Direction from the pool towards the sun.           |
| autoRipples  | boolean                                                                                                                | `true`          | `optional` Adds a small random ripple every 1.8 seconds.          |
| interactive  | boolean                                                                                                                | `true`          | `optional` Enables dragging the water surface and the boxes.      |
| sky          | boolean                                                                                                                | `true`          | `optional` Draws the procedural sky dome behind the pool.         |

Each entry of `boxes` describes one block: `position` is its center, `size` its full dimensions and `color` an optional CSS color. Every box is ray traced by the water shader, so adding boxes increases the shader cost; a handful of shapes keeps the effect fast.

## How It Works

- A CPU height field stores `(height, velocity, normal.x, normal.z)` per cell and runs the same two-pass wave equation as the original. The state is uploaded as an RGBA half float `DataTexture` and displaces the water plane in the vertex node.
- The caustic map is built by projecting every surface cell onto the pool floor along its refracted sun ray. Local compression of the projection concentrates light, so the caustic texture is indexed by surface coordinate and looked up where each floor pixel's sun ray entered the water.
- Water, the irregular tiled basin and the boxes are shaded with analytic ray tracing in TSL: the surface reflects and refracts the boxes, basin and procedural sky, while the basin receives the animated caustics and every box casts a soft shadow.
- Moving a box through the water displaces the height field around its footprint, so dragging a shape leaves a propagating wake.
- The simulation runs on a fixed 1/60 s accumulator with at most three catch-up steps per frame, so the ripples behave consistently regardless of the display refresh rate.

The tile texture is generated in a canvas, so the component downloads no assets. Geometry, materials, data textures, pointer listeners and the animation frame are all disposed when the component unmounts or its props change.

## Renderer Support

All shading is written with TSL node materials, so the same effect runs on both renderers:

- **WebGPU** executes the node graph directly with `WebGPURenderer`.
- **WebGL** compiles the same TSL graph to GLSL through `WebGLNodesHandler`.

Because the basin, boxes and sky are ray traced inside the shaders rather than captured from the scene, no render targets are involved and both backends produce the same image.
