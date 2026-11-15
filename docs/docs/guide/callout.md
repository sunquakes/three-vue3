---
lang: en-US
title: Callout
---

::: tip type
Class
:::

`Callout` draws a leader line from a 3D anchor point to a label position, with an optional anchor dot and a DOM label at the end. The line can be straight or broken into two segments with a corner, the label can be anchored to a fixed corner or slide along its bottom edge, and the label position can be animated with `moveTo`. The label animation and the auto-anchor refresh run on the callout's own animation loop, so no per-frame code is needed.

The label is a `CSS2DObject`, so it is drawn by the `CSS2DRenderer` that `<tv-scene>` already renders. `content` accepts a plain string, which is written as text into a wrapper element, or any `HTMLElement` you want to mount. The container element is appended to `document.body` and gets the id `callout-<uuid>`.

## Default Usage

<CalloutDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Callout } from 'three-vue3'

let callout: Callout | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  // A box at the origin that the annotation points to.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())
  scene.add(box)

  const label = document.createElement('div')
  label.textContent = 'This is a box!'
  label.style.padding = '8px 14px'
  label.style.background = 'linear-gradient(180deg, #ff8a2b 0%, #e66400 100%)'
  label.style.borderRadius = '4px'
  label.style.color = '#1a0f00'
  label.style.fontSize = '16px'
  label.style.fontWeight = '600'
  label.style.pointerEvents = 'auto'
  label.style.whiteSpace = 'nowrap'

  // Start on the box corner, end out to the right. `autoAnchor` keeps the
  // connection point facing the camera and `attach()` starts the loop.
  callout = new Callout([0.5, 0.5, 0.5], [1.5, 1.0, 0.5], label, {
    color: '#ffffff',
    lineWidth: 2,
    lineShape: 'broken',
    bendAxis: 'x',
    bendRatio: 2 / 3,
    autoAnchor: true,
    dashed: false,
    showDot: true,
    dotColor: '#ffffff',
    dotRadius: 0.06
  })
  scene.add(callout.scene)
  callout.attach(camera)
}

onBeforeUnmount(() => {
  callout?.dispose()
  callout = undefined
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 360px;
}
</style>
```

:::

## Constructor

```ts
new Callout(start: Position, end: Position, content: string | HTMLElement, options?: CalloutOptions)
```

| Name    | Type               | Description                                                       |
| ------- | ------------------ | ----------------------------------------------------------------- |
| start   | Position           | Anchor point of the line in world space.                          |
| end     | Position           | Label position in world space; the label is centered here unless `labelAnchor` or `autoAnchor` says otherwise. |
| content | string \| HTMLElement | Label content. A string is written as text into a wrapper element. |
| options | CalloutOptions     | Optional configuration, see below.                                |

## Options

| Name        | Type        | Default        | Description                                                                                                                              |
| ----------- | ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| color       | number \| string | `0xffffff` | `optional` Line color.                                                                                                                    |
| lineWidth   | number      | `1`            | `optional` Line width (WebGL2 only).                                                                                                      |
| lineShape   | LineShape   | `'broken'`     | `optional` Line shape: `'straight'` for a direct line, `'broken'` for an L-shape with a corner.                                            |
| bendAxis    | BendAxis    | `'auto'`       | `optional` Primary axis for the label-parallel segment of a broken line; `'auto'` uses the largest delta.                                  |
| bendRatio   | number      | `0.45`         | `optional` Ratio (0–1) along `bendAxis` from the label towards the anchor where the corner is placed.                                     |
| labelAnchor | LabelAnchor | `'bottom-left'`| `optional` Which corner/point of the label sits at `end`; ignored when `autoAnchor` is true.                                              |
| autoAnchor  | boolean     | `false`        | `optional` Slide the connection point along the label's bottom edge based on the screen-space direction from `end` to `start`.             |
| dashed      | boolean     | `false`        | `optional` Use a dashed line.                                                                                                             |
| dashSize    | number      | `0.1`          | `optional` Dash size for a dashed line.                                                                                                   |
| gapSize     | number      | `0.05`         | `optional` Gap size for a dashed line.                                                                                                     |
| showDot     | boolean     | `true`         | `optional` Show an anchor dot at the start point.                                                                                          |
| dotColor    | number \| string | same as `color` | `optional` Anchor dot color.                                                                                                       |
| dotRadius   | number      | `0.05`         | `optional` Anchor dot radius.                                                                                                             |
| showLabel   | boolean     | `true`         | `optional` Show the label at the end point.                                                                                               |

`LineShape` is `'straight' | 'broken'`, `BendAxis` is `'auto' | 'x' | 'y' | 'z'`, and `LabelAnchor` is `'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`.

## Methods

| Name                                    | Description                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| attach(camera)                          | Store the camera used by `autoAnchor` and start the callout's own refresh loop.                 |
| detach()                                | Stop the loop and stop tracking the camera.                                                     |
| moveTo(end, duration)                   | Animate the label to a new position; `duration` is in milliseconds.                            |
| setStart(start)                         | Instantly move the anchor point.                                                                |
| setEnd(end)                             | Instantly move the label point.                                                                 |
| setLineShape(shape, opts?)              | Switch between `'straight'` and `'broken'`, optionally with a new `bendAxis` / `bendRatio`.    |
| dispose()                               | Dispose the line and dot, remove the label DOM element and detach the camera.                  |

## Class usage

```ts
import * as THREE from 'three'
import { Callout } from 'three-vue3'

const callout = new Callout(
  [0.5, 0.5, 0],
  [2, 1.5, 0],
  'A sphere in the scene',
  { color: '#8ab4ff', dashed: true }
)
scene.add(callout.scene)

// Only needed when using autoAnchor, so the connection point can follow the camera:
callout.attach(camera)

// Animate the label to a new position over 800 ms:
callout.moveTo([1.2, 2, 0], 800)

// Mount a custom element instead of a string:
const label = document.createElement('strong')
label.textContent = 'Custom'
label.style.color = '#ffd166'
const custom = new Callout([0, 0, 0], [1, 1, 0], label)

// On teardown:
callout.dispose()
custom.dispose()
```
