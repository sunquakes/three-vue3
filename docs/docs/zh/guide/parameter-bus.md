---
lang: zh-CN
title: 参数总线
---

::: tip 类型
类
:::

`globalParameterBus` 是一个用于场景级共享值的轻量存储。效果组件订阅某个键并响应变化，因此一次更新就能同时驱动天空穹顶、灯光以及其他监听者。内置的键是 `sunDirection`。

## 默认用法

<ParameterBusDemo />

::: details 点击我查看代码

```vue
<template>
  <div>
    <tv-scene class="scene" @created="created"></tv-scene>
    <label class="control">
      太阳高度角
      <input v-model.number="elevation" type="range" min="-5" max="70" step="1" />
    </label>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { SkyDome, globalParameterBus } from 'three-vue3'

const elevation = ref(18)

let dome: SkyDome | undefined

const sunDirection = (degrees: number) => {
  const phi = THREE.MathUtils.degToRad(degrees)
  return new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0.6).normalize()
}

const created = (scene, { camera }) => {
  camera.position.set(0, 2, 8)

  // 未传入 sunDirection，穹顶会跟随全局参数总线。
  dome = new SkyDome({ radius: 60 })
  scene.add(dome)

  globalParameterBus.set('sunDirection', sunDirection(elevation.value))
}

watch(elevation, (value) => {
  globalParameterBus.set('sunDirection', sunDirection(value))
})

onBeforeUnmount(() => {
  dome?.dispose()
  globalParameterBus.reset()
})
</script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 14px;
}
</style>
```

:::

## 方法

| 名称      | 参数                                                 | 描述                       |
| --------- | ---------------------------------------------------- | -------------------------- |
| get       | `<K>(key: K) => GlobalParameters[K]`                 | 返回当前值。               |
| set       | `<K>(key: K, value: GlobalParameters[K]) => void`    | 写入值并通知订阅者。       |
| subscribe | `<K>(key: K, listener: (value) => void) => () => void` | 订阅变化，返回取消订阅函数。 |
| reset     | `() => void`                                         | 恢复默认值。               |

## GlobalParameters

| 名称         | 类型          | 默认值                          | 描述                 |
| ------------ | ------------- | ------------------------------- | -------------------- |
| sunDirection | THREE.Vector3 | 归一化后的 `(-0.78, 0.2, -0.6)` | 天空共享的太阳方向。 |

## 自定义实例

```ts
import { ParameterBus } from 'three-vue3'

const bus = new ParameterBus()
const unsubscribe = bus.subscribe('sunDirection', (direction) => {
  console.log(direction)
})
```
