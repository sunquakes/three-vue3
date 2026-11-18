---
lang: zh-CN
title: 扫光
---

::: tip 类型
类
:::

`SweepLight` 沿某个坐标轴，在目标对象的所有网格上扫过一条叠加发光带。它会克隆每个网格的几何体，用光带着色器重新绘制，因此原始材质不受影响，模型保持原有外观。扫光由自身动画循环驱动，无需逐帧代码。

## 默认用法

<SweepLightDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { GLTFLoader, SweepLight } from 'three-vue3'
import type * as THREE from 'three'

let effect: SweepLight | undefined
let model: THREE.Group | undefined

const created = async (scene, { camera }) => {
  if (!camera) return

  camera.position.set(0, 1.5, 3)
  camera.lookAt(0, 0, 0)

  model = await GLTFLoader('/models/perseverance.glb', true)
  model.scale.set(0.8, 0.8, 0.8)
  scene.add(model)

  // 扫光绘制在模型表面之上。
  effect = new SweepLight(model)
}

onBeforeUnmount(() => {
  effect?.dispose()
  effect = undefined
  if (model) {
    model.parent?.remove(model)
    model = undefined
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

| 名称      | 类型                                     | 默认值       | 描述                                     |
| --------- | ---------------------------------------- | ------------ | ---------------------------------------- |
| color     | number                                   | `0x00ffff`   | `可选` 扫光颜色。                        |
| speed     | number                                   | `0.5`        | `可选` 扫光速度，扫完一遍耗时 `2 / speed` 秒。 |
| width     | number                                   | `0.3`        | `可选` 光带宽度，取扫光轴 0-1 范围的比例。 |
| intensity | number                                   | `1.5`        | `可选` 光带强度。                        |
| direction | number                                   | `0`          | `可选` 扫光轴：0 = X，1 = Y，2 = Z。     |
| loop      | `LoopOnce` / `LoopRepeat` / `LoopPingPong` | `LoopRepeat` | `可选` 动画循环方式。                    |

## 方法

| 名称        | 参数                               | 描述                                 |
| ----------- | ---------------------------------- | ------------------------------------ |
| constructor | (target: THREE.Object3D, options?) | 在网格、分组或场景对象上创建扫光。   |
| play        | () => void                         | 播放或继续动画。                     |
| pause       | () => void                         | 在当前帧暂停动画。                   |
| stop        | () => void                         | 停止动画并重置到初始状态。           |
| dispose     | () => void                         | 销毁扫光网格与共享材质。             |

## 类用法

```ts
import { SweepLight } from 'three-vue3'

const sweep = new SweepLight(model, { color: 0x00ffff, speed: 0.5 })
scene.add(model)

// 扫光由自身动画循环驱动；销毁时：
sweep.dispose()
```
