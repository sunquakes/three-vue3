---
lang: en-US
title: HeightFog
---

::: tip type
Component
:::

`<tv-height-fog>` is a screen-space post-processing effect. The scene is rendered into a half-float render target with a depth texture, then a fullscreen quad rebuilds each fragment's world position from the depth buffer and composites an exponential height fog with flowing noise and directional inscattering.

Because the fog owns the render frame, do not combine it with `<tv-bloom>` in the same scene.

The effect runs on `WebGPURenderer` (the default) and on a classic `WebGLRenderer`; add `renderer-type="webgl"` to `<tv-scene>` to compare the two backends.

## Default Usage

<HeightFogDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :grid-helper="gridHelper"
    @created="created"
  >
    <tv-height-fog />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { globalParameterBus } from 'three-vue3'

// Columns receding into the distance: [x, z, width, height].
const pillars: [number, number, number, number][] = [
  [-5, 5, 2.8, 13],
  [6, 2, 3.2, 17],
  [-2, -4, 2.6, 11],
  [8, -9, 3.4, 21],
  [-9, -15, 3.0, 15],
  [3, -22, 2.8, 19],
  [-6, -30, 3.4, 23]
]

const gridHelper = {
  size: 400,
  divisions: 40,
  colorGrid: 0x3a4050,
  colorCenterLine: 0x4d5570,
  y: 0.02
}

const meshes: THREE.Mesh[] = []

const created = (scene, { camera }) => {
  camera.position.set(0, 5, 14)
  camera.lookAt(0, 7, -12)

  // Same direction the old lightAzimuth 30° / lightElevation 25° produced.
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.453, 0.423, 0.785))

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x5c6579, roughness: 0.85 })
  const columns = pillars.map(([x, z, width, height]) => {
    const column = new THREE.Mesh(geometry, material)
    column.position.set(x, height / 2, z)
    column.scale.set(width, height, width)
    return column
  })

  meshes.push(ground, ...columns)
  scene.add(...meshes)
}

onBeforeUnmount(() => {
  meshes.forEach((mesh) => {
    mesh.parent?.remove(mesh)
    mesh.geometry.dispose()
    const meshMaterial = mesh.material as THREE.Material
    meshMaterial.dispose()
  })
  meshes.length = 0
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

### Fog body

| Name             | Type                     | Default    | Description                                                          |
| ---------------- | ------------------------ | ---------- | -------------------------------------------------------------------- |
| fogColor         | string \| number \| Color | `'#c9d4cc'` | `optional` Fog color.                                                |
| fogDensity       | number                   | `0.02`     | `optional` Fog density at the fog plane.                             |
| fogHeight        | number                   | `10`       | `optional` World height of the fog plane.                            |
| fogHeightFalloff | number                   | `0.25`     | `optional` Density halves every `1 / falloff` units above the plane. |
| fogMaxOpacity    | number                   | `1`        | `optional` Upper bound for how much the fog can cover the scene.     |
| fogStartDistance | number                   | `0`        | `optional` Distance from the camera where fog accumulation starts.   |

### Flowing noise

| Name          | Type   | Default  | Description                                                   |
| ------------- | ------ | -------- | ------------------------------------------------------------- |
| noiseStrength | number | `0`      | `optional` Vertical displacement of the fog plane (0 disables). |
| noiseScale    | number | `0.012`  | `optional` Scale of the noise pattern in world units.          |
| noiseSpeedX   | number | `0`      | `optional` Noise flow speed along the X axis.                  |
| noiseSpeedZ   | number | `0`      | `optional` Noise flow speed along the Z axis.                  |

### Directional inscattering

| Name                        | Type                     | Default    | Description                                              |
| --------------------------- | ------------------------ | ---------- | -------------------------------------------------------- |
| inscatteringColor           | string \| number \| Color | `'#ffe2b0'` | `optional` Color of the light inscattering.               |
| inscatteringIntensity       | number                   | `1`        | `optional` Inscattering intensity.                        |
| inscatteringExponent        | number                   | `5`        | `optional` Sharpness of the falloff around the light.     |
| inscatteringStartDistance   | number                   | `0`        | `optional` Distance from the camera where it starts.      |

The light direction is shared, not a prop: the fog follows the sun stored in the [parameter bus](./parameter-bus), so it matches the sky dome.

```ts
globalParameterBus.set('sunDirection', new THREE.Vector3(0.453, 0.423, 0.785))
```
