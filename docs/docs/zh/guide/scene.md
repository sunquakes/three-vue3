---
lang: zh-CN
title: 场景
---

::: tip 类型
组件
:::

## 默认用法

<Scene />

::: details 点击我查看代码

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

## 背景颜色

<SceneBgColor />

::: details 点击我查看代码

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

## 背景图片

<SceneBgImage />

::: details 点击我查看代码

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

## 属性

`<tv-scene>` 默认使用 `WebGPURenderer` 渲染；设置 `renderer-type="webgl"` 后，同一个场景会改由 `WebGLRenderer` 与 `WebGLNodesHandler` 渲染。它还会像 r3l 一样在 `y = 0.01` 处添加一个灰色 `THREE.GridHelper`（20 × 20 分段）；传入 `:grid-helper="false"` 可隐藏，或传入选项对象 `{ size, divisions, colorCenterLine, colorGrid, y }` 自行定制。

| 名称               | 类型                                             | 默认值                  | 描述                                                              |
| ------------------ | ------------------------------------------------ | ----------------------- | ----------------------------------------------------------------- |
| v-model            | THREE.Scene                                      | THREE.Scene             | `可选` 组件挂载后，值将是从 undefined 变为 THREE.Scene 实例。     |
| v-model:renderer   | WebGPURenderer \| WebGLRenderer                  | WebGPURenderer          | `可选`                                                            |
| renderer-type      | 'webgpu' \| 'webgl'                              | 'webgpu'                | `可选` 未传入 `renderer` 时使用的后端。                           |
| v-model:camera     | THREE.Camera                                     | THREE.PerspectiveCamera | `可选` 默认为透视相机（PerspectiveCamera）。                      |
| v-model:light      | THREE.Light                                      | THREE.HemisphereLight   | `可选` 默认为半球光（HemisphereLight）。                          |
| v-model:axesHelper | THREE.AxesHelper \| boolean                      | THREE.AxesHelper        | `可选` 默认为坐标轴辅助（AxesHelper），设置为 false 可隐藏它。    |
| v-model:gridHelper | THREE.GridHelper \| GridHelperOptions \| boolean | GridHelper              | `可选` 默认为 20 × 20、位于 y = 0.01 的灰色网格，false 可隐藏它。 |
| v-model:controls   | OrbitControls \| boolean                         | OrbitControls           | `可选` 默认为轨道控制器（OrbitControls），设置为 false 可禁用它。 |

## 方法

| 名称          | 参数                                                                                                    | 描述                       |
| ------------- | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| created       | (scene, {camera, light, axesHelper, gridHelper, controls }) => void                                     | 组件挂载并创建场景时调用。 |
| callbackFrame | (renderer, scene: THREE.Scene, components: {camera, light, axesHelper, gridHelper, controls }) => void  | 帧回调函数。               |
