---
lang: en-US
title: Force Shield
---

::: tip type
Class
:::

`ForceShield` is a hexagonal force field that wraps a sphere. A tri-planar hex grid, a fresnel rim, layered flow noise and a per-cell flicker build the surface; a noise threshold dissolves the shell so it can drop and raise itself, and the dissolve edge glows while it travels.

`hit(point)` fires an impact ring from a world-space contact and drains health, blending the surface towards red as `life` falls. The shield animates from its own clock, so the dissolve and the impact rings need no per-frame code.

## Default Usage

<ForceShieldDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { ForceShield } from 'three-vue3'

let effect: ForceShield | undefined
let timer: ReturnType<typeof setInterval> | undefined
let removeListener: (() => void) | undefined

const created = (scene, { camera, controls }) => {
  if (!camera || !controls) return

  camera.position.set(0, 0.8, 4.6)
  camera.lookAt(0, 0, 0)

  effect = new ForceShield({ radius: 1.8, hitDamage: 3 })
  scene.add(effect)

  // Clicking the field fires an impact where the ray hits it.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const handlePointerDown = (event: PointerEvent) => {
    const canvas = controls.domElement
    const rect = canvas.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(pointer, camera)
    effect?.hit(raycaster.intersectObject(effect)[0]?.point)
  }

  controls.domElement.addEventListener('pointerdown', handlePointerDown)
  removeListener = () => {
    controls.domElement.removeEventListener('pointerdown', handlePointerDown)
  }

  // Automatic impacts keep the demo moving; the shield resets once depleted.
  timer = window.setInterval(() => {
    if (!effect) return
    effect.hit()
    if (effect.life < 0.6) effect.life = 1
  }, 1400)
}

onBeforeUnmount(() => {
  removeListener?.()
  removeListener = undefined
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
  effect?.dispose()
  effect = undefined
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

## Options

| Name                | Type                     | Default    | Description                                                                   |
| ------------------- | ------------------------ | ---------- | ----------------------------------------------------------------------------- |
| radius              | number                   | `1.8`      | `optional` Sphere radius.                                                     |
| active              | boolean                  | `true`     | `optional` Whether the shield is raised or dissolved.                         |
| reveal              | number                   | —          | `optional` Freeze the dissolve at this progress (`0` visible, `1` dissolved). |
| revealSpeed         | number                   | `3.5`      | `optional` Speed of the automatic dissolve animation.                         |
| color               | ColorRepresentation      | `0x26aeff` | `optional` Base shield color.                                                 |
| opacity             | number                   | `0.76`     | `optional` Overall surface opacity.                                           |
| hexScale            | number                   | `3`        | `optional` Hex grid tiling.                                                   |
| hexOpacity          | number                   | `0.13`     | `optional` Hex cell brightness.                                               |
| showHex             | boolean                  | `true`     | `optional` Draw the hexagonal cell grid.                                      |
| edgeWidth           | number                   | `0.06`     | `optional` Hex seam width.                                                    |
| fresnelPower        | number                   | `1.8`      | `optional` Fresnel falloff exponent.                                          |
| fresnelStrength     | number                   | `1.75`     | `optional` Fresnel edge brightness.                                           |
| fadeStart           | number                   | `0`        | `optional` Y below which the shield fades to the ground; `-1` disables it.    |
| flashSpeed          | number                   | `0.6`      | `optional` Cell flicker speed.                                                |
| flashIntensity      | number                   | `0.11`     | `optional` Cell flicker brightness.                                           |
| noiseScale          | number                   | `1.3`      | `optional` Dissolve noise scale.                                              |
| noiseEdgeColor      | ColorRepresentation      | `0x26aeff` | `optional` Color of the dissolve edge.                                        |
| noiseEdgeWidth      | number                   | `0.02`     | `optional` Width of the dissolve edge.                                        |
| noiseEdgeIntensity  | number                   | `10`       | `optional` Brightness of the dissolve edge.                                   |
| noiseEdgeSmoothness | number                   | `0.5`      | `optional` Sharpness of the dissolve edge.                                    |
| flowScale           | number                   | `2.4`      | `optional` Flow noise scale.                                                  |
| flowSpeed           | number                   | `1.13`     | `optional` Flow noise speed.                                                  |
| flowIntensity       | number                   | `4`        | `optional` Flow noise brightness.                                             |
| hitRingSpeed        | number                   | `1.75`     | `optional` Speed of the impact ring.                                          |
| hitRingWidth        | number                   | `0.12`     | `optional` Thickness of the impact ring.                                      |
| hitMaxRadius        | number                   | `0.85`     | `optional` Maximum angular radius of the impact ring.                         |
| hitDuration         | number                   | `1.8`      | `optional` Seconds an impact stays visible.                                   |
| hitIntensity        | number                   | `4.1`      | `optional` Brightness of the impact.                                          |
| hitImpactRadius     | number                   | `0.3`      | `optional` Angular radius of the contact highlight.                           |
| hitDamage           | number                   | `5`        | `optional` Health removed per hit, in percent.                                |
| life                | number                   | `1`        | `optional` Initial shield health (`1` intact, `0` depleted).                  |

## Class usage

```ts
import * as THREE from 'three'
import { ForceShield } from 'three-vue3'

const shield = new ForceShield({ radius: 1.8 })
scene.add(shield)

// The dissolve and impact rings advance from the shield's own clock.
// Dissolve out, then raise it again:
shield.setActive(false)
shield.setActive(true)

// Fire an impact at a world-space point:
shield.hit(new THREE.Vector3(1, 0.6, 1.2))

// On teardown:
shield.dispose()
```
