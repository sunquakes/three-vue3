---
lang: en-US
title: Water Pool
---

::: tip type
Component
:::

`<tv-water-pool>` renders an interactive, ray-traced water pool inside a `<tv-scene>`. It is a port of [Evan Wallace's webgl-water](https://madebyevan.com/webgl-water/) and the `WaterPool` component from [react-three-lite](https://github.com/sunquakes/react-three-lite).

A CPU height field drives the ripples and caustic light map, which are uploaded as data textures. The water surface, tiled basin, and procedural sky are shaded by analytical rays in the fragment shader, so WebGPU and WebGL show the same reflection, refraction, and caustic result without extra scene captures.

## Default Usage

<WaterPoolDemo />

::: details Click me to view the pool setup

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water-pool :shape="WATER_OUTLINE" :scale="WATER_SCALE" />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const WATER_SCALE = 0.7
const TUB_SCALE: [number, number, number] = [1.59, 1.15, 0.868]
const WATER_HALF_X = (0.33 * TUB_SCALE[0] + 0.02) / WATER_SCALE
const WATER_HALF_Z = (0.72 * TUB_SCALE[2] + 0.02) / WATER_SCALE
const WATER_OUTLINE: [number, number][] = [
  [-WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, WATER_HALF_Z],
  [-WATER_HALF_X, WATER_HALF_Z]
]

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.55, 0.9, 0.35))
  if (!camera) return
  camera.position.set(1.75, 2.2, 2.0)
  if (controls) controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
}
</script>
```

:::

The live demo loads `/models/water-tub.glb` without Draco at scale `[1.59, 1.15, 0.868]` and position `[0, 0.09 - 0.53 * 1.15, 0]`. Its `SkyDome` uses horizon `0x94c2f0`, lower sky `0x7fb4ec`, upper sky `0x3d7bd5`, zenith `0x296bc7`, glow `0xfff1d8`, sun `0xfff7e6`, intensity `2.2`, and sun size `5`, with the default radius `420` and `48` segments. Models, the dome, and late asynchronous loads are disposed on scene teardown.

Drag the water to add ripples; drag outside it to orbit the camera.

## Irregular Pool

<WaterPoolIrregularDemo />

::: details Click me to view the shaped-pool setup

```vue
<tv-water-pool :shape="TUB_OUTLINE" :scale="0.536 * 1.7" :position="[0, 0.33 * 1.7, 0]" />

<script lang="ts" setup>
const TUB_OUTLINE: [number, number][] = [
  [-1, 0],
  [-0.987, -0.106],
  [-0.945, -0.207],
  [-0.879, -0.291],
  [-0.795, -0.358],
  [-0.694, -0.399],
  [-0.588, -0.412],
  [0.513, -0.412],
  [0.619, -0.399],
  [0.72, -0.358],
  [0.804, -0.291],
  [0.871, -0.207],
  [0.981, -0.028],
  [0.981, 0.028],
  [0.871, 0.207],
  [0.804, 0.291],
  [0.72, 0.358],
  [0.619, 0.399],
  [0.513, 0.412],
  [-0.588, 0.412],
  [-0.694, 0.399],
  [-0.795, 0.358],
  [-0.879, 0.291],
  [-0.945, 0.207],
  [-0.987, 0.106]
]
</script>
```

:::

The camera is `[1.7, 1.35, 1.9]`, targeting `[0, 0.3, 0]`, with background `rgb(40, 42, 54)` and axes/grid helpers disabled. This demo uses the same sun direction and `SkyDome` configuration as the default pool. `/models/bathtub.glb` is loaded without Draco at uniform scale `1.7` and position `[-0.595 * 1.7, 0, 0.28 * 1.7]`.

## Props

| Name        | Type                                        | Default                             | Description                                                                       |
| ----------- | ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| resolution  | number                                      | `128`                               | `optional` Height-field cells per axis, clamped to 8–512.                         |
| shape       | 'box' \| WaterPoolOutline \| BufferGeometry | `WATER_POOL_IRREGULAR_CUBE_OUTLINE` | `optional` Built-in square, custom convex outline, or geometry projected onto XZ. |
| segments    | number                                      | `160`                               | `optional` Subdivisions around the resolved container outline.                    |
| autoRipples | boolean                                     | `true`                              | `optional` Adds a small random ripple every 1.8 seconds.                          |
| interactive | boolean                                     | `true`                              | `optional` Enables dragging the water surface to create drops.                    |
| position    | Vector3 \| [number, number, number]         | `[0, 0, 0]`                         | `optional` World position of the water surface center.                            |
| scale       | number                                      | `1`                                 | `optional` Positive uniform scale applied to both the footprint and pool depth.   |

```ts
type WaterPoolOutline = readonly (readonly [number, number])[]
```

`shape="box"` resolves to `WATER_POOL_BOX_OUTLINE`, a square with `x` and `z` from `-1` to `1`. The default `WATER_POOL_IRREGULAR_CUBE_OUTLINE` is a skewed quadrilateral. Custom outlines and geometry vertices are reduced to a convex hull with collinear points removed; the result must contain the origin and stay within `-1…1`. Both built-in outlines are exported for reuse.

The component follows `globalParameterBus` for its sun direction; it does not expose the former local explicit-sun, box, sky, curvature, or edge-width props. Pointer rays and drops are transformed into pool-local coordinates, so interaction remains aligned after `position` and `scale` changes.

## How It Works

- A CPU height field stores `(height, velocity, normal.x, normal.z)` per cell and runs the two-pass wave equation. The state is uploaded as an RGBA half-float `DataTexture` and displaces the water surface in the vertex node.
- The caustic map projects surface cells onto the pool floor along their refracted sun rays. Local compression of the projection concentrates light into animated caustics.
- The single water surface uses analytical ray tracing in TSL to reflect and refract the tiled basin and procedural sky, including the pool walls and floor.
- Dragging the water adds drops to the height field, producing propagating wakes while preserving orbit-control handoff outside the pool.
- The simulation runs on a fixed 1/60 s accumulator with at most three catch-up steps per frame, so ripples behave consistently across display refresh rates.

The tile texture is generated in a canvas, so the component itself downloads no assets. The GLBs in these examples are demo scenery only. Replaced geometry, materials, textures, listeners, animation callbacks, and subscriptions are disposed on rebuild and unmount.

## Renderer Support

All shading is written with TSL node materials, so the same effect runs on both renderers:

- **WebGPU** executes the node graph directly with `WebGPURenderer`.
- **WebGL** compiles the same TSL graph to GLSL through `WebGLNodesHandler`.
