---
lang: en-US
title: Parameter Bus
---

::: tip type
Class
:::

`globalParameterBus` is a tiny shared store for scene-wide values. Effects subscribe to a key and react to changes, so a single update reaches the sky dome, the lights, and anything else listening. `sunDirection` is the built-in key.

## Default Usage

<ParameterBusDemo />

::: details Click me to view the codes

```vue
<template>
  <div>
    <tv-scene class="scene" @created="created"></tv-scene>
    <label class="control">
      Sun elevation
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

  // No sunDirection is passed, so the dome follows the global parameter bus.
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

## Methods

| Name      | Parameters                                           | Description                                              |
| --------- | ---------------------------------------------------- | -------------------------------------------------------- |
| get       | `<K>(key: K) => GlobalParameters[K]`                 | Returns the current value.                               |
| set       | `<K>(key: K, value: GlobalParameters[K]) => void`    | Writes a value and notifies subscribers.                 |
| subscribe | `<K>(key: K, listener: (value) => void) => () => void` | Subscribes to changes, returns an unsubscribe function. |
| reset     | `() => void`                                         | Restores the default values.                             |

## GlobalParameters

| Name         | Type              | Default                              | Description                        |
| ------------ | ----------------- | ------------------------------------ | ---------------------------------- |
| sunDirection | THREE.Vector3     | `(-0.78, 0.2, -0.6)` normalized      | Shared sun direction used by the sky. |

## Custom instance

```ts
import { ParameterBus } from 'three-vue3'

const bus = new ParameterBus()
const unsubscribe = bus.subscribe('sunDirection', (direction) => {
  console.log(direction)
})
```
