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

| Name               | Type                        | Default                 | Description                                                                                            |
| ------------------ | --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| v-model            | THREE.Scene                 | THREE.Scene             | `optional` The value will be the `THREE.Scene` instance from `undefined` after the components mounted. |
| v-model:renderer   | THREE.WebGLRenderer         | THREE.WebGLRenderer     | `optional`                                                                                             |
| clearColor         | String                      |                         | `optional` The clear color of the scene.                                                               |
| v-model:camera     | THREE.Camera                | THREE.PerspectiveCamera | `optional` Defaults to a PerspectiveCamera.                                                            |
| v-model:light      | THREE.Light                 | THREE.HemisphereLight   | `optional` Defaults to a HemisphereLight.                                                              |
| v-model:axesHelper | THREE.AxesHelper \| boolean | THREE.AxesHelper        | `optional` Defaults to a AxesHelper, `false` to hide it.                                               |
| v-model:controls   | OrbitControls \| boolean    | OrbitControls           | `optional` Defaults to a OrbitControls, `false` to disable it.                                         |

## Methods

| Name          | Parameters                                                                                                      | Description                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| created       | (scene, {camera, light, axesHelper, controls }) => void                                                         | Called when the component is mounted and the scene is created. |
| callbackFrame | (renderer: THREE.WebGLRenderer, scene: THREE.Scene, components: {camera, light, axesHelper, controls }) => void | The callback function of the render loop.                      |
