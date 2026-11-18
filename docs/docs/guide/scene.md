---
lang: en-US
title: Scene
---

::: tip type
Component
:::

## Default Usage

<Scene />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene"></tv-scene>
</template>

<script lang="ts" setup></script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Color As Background

<SceneBgColor />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="#98F5F9"></tv-scene>
</template>

<script lang="ts" setup></script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Image As Background

<SceneBgImage />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-image="/images/examples/bg.jpg"></tv-scene>
</template>

<script lang="ts" setup></script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Props

`<tv-scene>` renders with `WebGPURenderer` by default. Set `renderer-type="webgl"` to run the same scene through `WebGLRenderer` and `WebGLNodesHandler`. It also adds a grey `THREE.GridHelper` at `y = 0.01` (20 × 20 divisions) the same way r3l does; pass `:grid-helper="false"` to hide it, or an options object `{ size, divisions, colorCenterLine, colorGrid, y }` to customise it.

| Name               | Type                                                          | Default                 | Description                                                                                            |
| ------------------ | ------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| v-model            | THREE.Scene                                                   | THREE.Scene             | `optional` The value will be the `THREE.Scene` instance from `undefined` after the components mounted. |
| v-model:renderer   | WebGPURenderer \| WebGLRenderer                               | WebGPURenderer          | `optional`                                                                                             |
| renderer-type      | 'webgpu' \| 'webgl'                                           | 'webgpu'                | `optional` Backend used when no `renderer` is supplied.                                                |
| clearColor         | String                                                        |                         | `optional` The clear color of the scene.                                                               |
| v-model:camera     | THREE.Camera                                                  | THREE.PerspectiveCamera | `optional` Defaults to a PerspectiveCamera.                                                            |
| v-model:light      | THREE.Light                                                   | THREE.HemisphereLight   | `optional` Defaults to a HemisphereLight.                                                              |
| v-model:axesHelper | THREE.AxesHelper \| boolean                                   | THREE.AxesHelper        | `optional` Defaults to a AxesHelper, `false` to hide it.                                               |
| v-model:gridHelper | THREE.GridHelper \| GridHelperOptions \| boolean              | GridHelper              | `optional` Defaults to a 20 × 20 grey grid at `y = 0.01`, `false` to hide it.                          |
| v-model:controls   | OrbitControls \| boolean                                      | OrbitControls           | `optional` Defaults to a OrbitControls, `false` to disable it.                                         |

## Methods

| Name          | Parameters                                                                                                      | Description                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| created       | (scene, {camera, light, axesHelper, gridHelper, controls }) => void                                             | Called when the component is mounted and the scene is created. |
| callbackFrame | (renderer, scene: THREE.Scene, components: {camera, light, axesHelper, gridHelper, controls }) => void          | The callback function of the render loop.                      |
