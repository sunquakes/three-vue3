---
lang: zh-CN
title: 拾取
---

::: tip 类型
类
:::

`Picker` 把画布上的指针事件转换为 `hover` 和 `click` 事件。它会把指针移动合并为每帧一次射线检测，可选遍历子对象，并忽略拖拽，因此旋转相机不会误触发点击。

## 默认用法

<PickerDemo />

::: details 点击我查看代码

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Picker } from 'three-vue3'

const COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xe57373, 0xba68c8, 0x4db6ac]
const POSITIONS: Array<[number, number, number]> = [
  [-3, 0, 0],
  [-1.8, 0, 0],
  [-0.6, 0, 0],
  [0.6, 0, 0],
  [1.8, 0, 0],
  [3, 0, 0]
]

let picker: Picker | undefined
let hovered: THREE.Mesh | null = null

const created = (scene, { camera, renderer }) => {
  camera.position.set(0, 1, 6)
  camera.lookAt(0, 0, 0)

  POSITIONS.forEach((position, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: COLORS[index] })
    )
    mesh.position.set(...position)
    scene.add(mesh)
  })

  picker = new Picker(scene, camera, renderer.domElement)

  // 悬停时把自发光调亮，离开后复位。
  picker.on('hover', (event) => {
    if (hovered) {
      ;(hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
      hovered = null
    }
    if (event) {
      hovered = event.object as THREE.Mesh
      ;(hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x444444)
    }
    renderer.domElement.style.cursor = event ? 'pointer' : ''
  })

  // 点击时随机换色。
  picker.on('click', (event) => {
    if (!event) return
    const material = (event.object as THREE.Mesh).material as THREE.MeshStandardMaterial
    material.color.setHex(Math.floor(Math.random() * 0xffffff))
  })
}

onBeforeUnmount(() => {
  picker?.dispose()
  picker = undefined
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

## 构造函数

```ts
const picker = new Picker(scene, camera, renderer.domElement, {
  targets: [model],
  filter: (object) => object.userData.selectable === true
})
```

| 名称           | 类型                                | 默认值 | 描述                                 |
| -------------- | ----------------------------------- | ------ | ------------------------------------ |
| targets        | THREE.Object3D[]                    |        | `可选` 参与检测的对象，默认整个场景。 |
| recursive      | boolean                             | `true` | `可选` 是否遍历目标的子对象。         |
| filter         | (object: THREE.Object3D) => boolean |        | `可选` 仅保留通过判断的相交结果。     |
| enableHover    | boolean                             | `true` | `可选` 指针移动时触发 `hover` 事件。  |
| clickThreshold | number                              | `5`    | `可选` 判定为点击的最大指针位移（像素）。 |
| layers         | number \| number[]                  |        | `可选` 参与拾取的相机图层。           |
| near / far     | number                              |        | `可选` 射线检测的近 / 远平面。        |

## 方法

| 名称       | 参数                                                    | 描述                                  |
| ---------- | ------------------------------------------------------- | ------------------------------------- |
| on         | (type: 'click' \| 'hover', listener) => () => void      | 订阅事件，返回取消订阅函数。          |
| off        | (type, listener) => void                                | 取消订阅。                            |
| pickAt     | (clientX: number, clientY: number) => PickEvent \| null | 按客户端坐标直接做一次拾取。          |
| setTargets | (targets?: THREE.Object3D[]) => void                    | 替换检测对象，`undefined` 表示整个场景。 |
| setFilter  | (filter?: (object) => boolean) => void                  | 替换相交过滤函数。                    |
| setEnabled | (enabled: boolean) => void                              | 启用或禁用拾取（不解除绑定）。        |
| getHovered | () => THREE.Object3D \| null                            | 当前指针下的对象。                    |
| dispose    | () => void                                              | 移除监听并释放引用。                  |

## PickEvent

| 名称          | 类型                  | 描述                     |
| ------------- | --------------------- | ------------------------ |
| object        | THREE.Object3D        | 被相交的对象。           |
| point         | THREE.Vector3         | 相交点的世界坐标。       |
| distance      | number                | 相机到相交点的距离。     |
| intersection  | THREE.Intersection    | 通过过滤的最近相交结果。 |
| intersections | THREE.Intersection[]  | 全部相交结果，按距离排序。 |
| pointer       | THREE.Vector2         | 指针的归一化设备坐标。   |
