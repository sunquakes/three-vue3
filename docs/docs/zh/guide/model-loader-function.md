---
lang: zh-CN
title: 函数加载器
---

::: tip type
函数
:::

## GLTF 加载器

### 默认用法

<GLTFLoaderFunction />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { GLTFLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // 加载模型到场景中。
  const model = await GLTFLoader('/models/perseverance.glb')
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## FBX 加载器

### 默认用法

<FBXLoaderFunction />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { FBXLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // 加载模型到场景中。
  const model = await FBXLoader('/models/perseverance.fbx')
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## OBJ 加载器

### 默认用法

<OBJLoaderFunction />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { OBJLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // 加载模型到场景中。
  const model = await OBJLoader('/models/obj/perseverance.obj', '/models/obj/perseverance.mtl')
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)
}
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

::::

## 参数

| 名称       | 类型     | 默认值 | 描述                                                                                |
| ---------- | -------- | ------ | ----------------------------------------------------------------------------------- |
| url        | string   |        | `必需` 模型的 URL。                                                                 |
| mtlUrl     | string   |        | ?`必需` 模型的材质 URL。只有 `OBJLoader` 有这个参数。                               |
| cache      | boolean  | true   | `可选` 是否将模型缓存到 IndexedDB 中。                                              |
| onProgress | function |        | `可选` 模型加载进度的回调函数。 (event: {type: string, progress: number}) => void。 |
