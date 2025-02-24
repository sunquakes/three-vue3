---
lang: zh-CN
title: 动画
---

::: tip type
类
:::

## 默认用法

<Animation />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="#FAEBD7" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { GLTFLoader, Animation } from 'three-vue3'

const created = async (scene, { camera }) => {
  scene.position.set(0, -0.5, 0)
  camera.position.set(0, 1.5, 3)

  // 加载模型到场景中。
  const model = await GLTFLoader('/models/perseverance.glb')
  scene.add(model)

  // 播放动画。
  const animation = new Animation(model)
  animation.playAll()
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

## 方法

| 名称                 | 参数                                                                                          | 描述                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| constructor          | (mesh: THREE.Mesh) => void                                                                    | `mesh` 传THREE.Mesh 对象。                                                                   |
| set                  | (index: number) => this                                                                       | `index` 当前播放的动画索引。                                                                 |
| setByName            | (name: string) => this                                                                        | `name` 当前动画的名称。                                                                      |
| setLoop              | (loop: typeof THREE.LoopOnce \| typeof THREE.LoopRepeat \| typeof THREE.LoopPingPong) => this | `loop` 当前动画播放循环方式。                                                                |
| setTimeScale         | (timeScale: number) => this                                                                   | `timeScale` 当前动画播放速度。                                                               |
| setClampWhenFinished | (clampWhenFinished: boolean) => this                                                          | `clampWhenFinished` 当前动画是否在播放完成时停止。                                           |
| play                 | () => void                                                                                    | 播放动画。默认播放mesh中第一个动画。如果要播放特定的动画，需要先调用`set`或`setByName`方法。 |
| playAll              | () => void                                                                                    | 播放模型中的所有动画。                                                                       |
| stop                 | () => void                                                                                    | 停止动画，只能停止使用`play`方法播放的动画。                                                 |
| stopAll              | () => void                                                                                    | 停止所有动画。只能停止使用`playAll`方法播放的动画。                                          |
| pause                | () => void                                                                                    | 暂停动画，只能暂停使用`play`方法播放的动画。                                                 |
| pauseAll             | () => void                                                                                    | 暂停所有动画。只能暂停使用`playAll`方法播放的动画。                                          |
