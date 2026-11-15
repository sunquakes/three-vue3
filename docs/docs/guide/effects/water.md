---
lang: en-US
title: Water
---

::: tip type
Component
:::

`<tv-water>` renders a cinematic shallow ocean surface inside a `<tv-scene>`. A displaced 420 m plane is driven by a 14 wave directional spectrum shared between the GPU vertex node and a CPU sampler, so the waterline test follows the surface the shader actually renders.

Shading includes Fresnel reflectance, GGX sun glitter, foam, depth based water colors and planar reflection / refraction of the surrounding scene. Everything is a TSL node material, so it renders on `WebGPURenderer` (the default) and on a classic `WebGLRenderer` through `WebGLNodesHandler`. Add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

## Default Usage

<WaterDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-water />
  </tv-scene>
</template>

<script lang="ts" setup>
import * as THREE from 'three'

const created = (_scene: THREE.Scene, { camera }: { camera?: THREE.Camera }) => {
  if (!camera) return
  camera.position.set(0, 1.5, 3)
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

::: tip
Place the camera just above the surface (`y` around 1–2) and look slightly down at the horizon. Points near the origin sample the full wave spectrum, so the crests, foam and glitter are most visible there.
:::

## Props

| Name              | Type                                  | Default             | Description                                                            |
| ----------------- | ------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| sunDirection      | Vector3 \| [number, number, number]   | `[-0.58, 0.1, -0.81]` | `optional` Direction from the water surface towards the sun.          |
| captureResolution | number                                | `512`               | `optional` Longest edge of the planar reflection and refraction captures, in device pixels. |
| segments          | number                                | `240`               | `optional` Plane subdivisions per axis.                                |
| size              | number                                | `420`               | `optional` Size of the water patch, in world units.                    |

## Renderer Support

- **WebGPU** uses the `reflector()` node for planar reflection and `viewportSharedTexture()` for refraction, both handled by the render graph.
- **WebGL** renders a mirrored planar reflection and a refraction capture of the scene (water excluded) into half float render targets every frame, then samples them in the water shader.

Captures are sized from the drawing buffer, clamped between 14% and 42% of its longest edge and scaled by `captureResolution`. When the camera drops below the animated surface, the water shades its underside and the planar captures are skipped until the camera rises again.

Changing any prop rebuilds the mesh, geometry, textures and render targets, and everything is disposed when the component unmounts or `<tv-scene>` is torn down.
