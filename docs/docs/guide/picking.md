---
lang: en-US
title: Picker
---

::: tip type
Class
:::

`Picker` turns pointer events on the canvas into `hover` and `click` events. It coalesces pointer moves into one raycast per frame, optionally traverses descendants, and ignores drags so orbiting the camera does not fire a click.

## Default Usage

<PickerDemo />

::: details Click me to view the codes

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

## Constructor

```ts
const picker = new Picker(scene, camera, renderer.domElement, {
  targets: [model],
  filter: (object) => object.userData.selectable === true
})
```

| Name        | Type                                     | Default | Description                                          |
| ----------- | ---------------------------------------- | ------- | ---------------------------------------------------- |
| targets     | THREE.Object3D[]                         |         | `optional` Objects to test, defaults to the scene.   |
| recursive   | boolean                                  | `true`  | `optional` Traverse descendants of the targets.      |
| filter      | (object: THREE.Object3D) => boolean      |         | `optional` Keep only the intersections passing it.   |
| enableHover | boolean                                  | `true`  | `optional` Emit `hover` events on pointer move.      |
| clickThreshold | number                                | `5`     | `optional` Max pointer travel in pixels for a click.  |
| layers      | number \| number[]                       |         | `optional` Camera layers to pick from.               |
| near / far  | number                                   |         | `optional` Raycaster near / far planes.              |

## Methods

| Name        | Parameters                                              | Description                                         |
| ----------- | ------------------------------------------------------- | --------------------------------------------------- |
| on          | (type: 'click' \| 'hover', listener) => () => void      | Subscribes and returns an unsubscribe function.     |
| off         | (type, listener) => void                                | Unsubscribes a listener.                            |
| pickAt      | (clientX: number, clientY: number) => PickEvent \| null | Raycasts at a client position without an event.     |
| setTargets  | (targets?: THREE.Object3D[]) => void                    | Replaces the objects, `undefined` picks the scene.  |
| setFilter   | (filter?: (object) => boolean) => void                  | Replaces the intersection filter.                   |
| setEnabled  | (enabled: boolean) => void                              | Enables or disables picking without detaching.      |
| getHovered  | () => THREE.Object3D \| null                            | The object currently under the pointer.             |
| dispose     | () => void                                              | Detaches listeners and releases references.         |

## PickEvent

| Name          | Type                     | Description                                    |
| ------------- | ------------------------ | ---------------------------------------------- |
| object        | THREE.Object3D           | The intersected object.                        |
| point         | THREE.Vector3            | Intersection point in world space.             |
| distance      | number                   | Distance from the camera to the point.         |
| intersection  | THREE.Intersection       | The closest intersection that passed the filter. |
| intersections | THREE.Intersection[]     | All intersections, sorted by distance.         |
| pointer       | THREE.Vector2            | Pointer position in normalized device coordinates. |
