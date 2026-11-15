---
lang: zh-CN
title: 灯光渐变
---

::: tip 类型
类
:::

`LightGradient` 用 ease-out-cubic 曲线，把一盏灯光（或分组内的所有灯光）的颜色和强度从当前值过渡到目标值。动画由渲染计时器自动推进，过渡结束时触发一次 `onComplete`。

## 默认用法

<LightGradientDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { LightGradient } from 'three-vue3'

let gradient: LightGradient | undefined
let mesh: THREE.Mesh | undefined

const created = (scene, { camera, light }) => {
  if (!camera || !light) return

  camera.position.set(0, 0, 4)
  camera.lookAt(0, 0, 0)

  // 用一个橙色立方体展示灯光效果。
  mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5, metalness: 0.5 })
  )
  mesh.position.y = 0.75
  scene.add(mesh)

  // 循环播放渐变动画。
  const loopGradient = () => {
    // 每轮开始前把灯光组内的所有灯光强度重置为基础值。
    // `light` 是一个 Group（AmbientLight + DirectionalLight）。
    light.traverse((child) => {
      if (child.isLight) child.intensity = 2
    })
    gradient?.dispose()
    gradient = new LightGradient(light, {
      intensity: 20,
      duration: 4000,
      onComplete: loopGradient
    })
  }

  loopGradient()
}

onBeforeUnmount(() => {
  gradient?.dispose()
  gradient = undefined
  if (mesh) {
    mesh.parent?.remove(mesh)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    mesh = undefined
  }
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

## 配置项

| 名称       | 类型             | 默认值 | 描述                                   |
| ---------- | ---------------- | ------ | -------------------------------------- |
| color      | string \| number | -      | `可选` 目标灯光颜色（十六进制字符串或数值）。 |
| intensity  | number           | -      | `可选` 目标灯光强度。                  |
| duration   | number           | `1000` | `可选` 渐变时长，单位为毫秒。          |
| onComplete | () => void       | -      | `可选` 动画完成时的回调。              |

## 方法

| 名称        | 参数                                               | 描述                                     |
| ----------- | -------------------------------------------------- | ---------------------------------------- |
| constructor | (light: THREE.Light \| THREE.Object3D, options?)   | 创建渐变，从灯光当前值开始过渡。         |
| dispose     | () => void                                         | 停止渐变动画并释放资源。                 |

## 类用法

```ts
import { LightGradient } from 'three-vue3'

const gradient = new LightGradient(light, {
  color: '#ff0000',
  intensity: 10,
  duration: 2000,
  onComplete: () => console.log('done')
})

// 销毁时：
gradient.dispose()
```
