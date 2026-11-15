---
lang: en-US
title: Popup
---

::: tip type
Class
:::

## Default Usage

<Popup />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="popup" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { Popup } from 'three-vue3'
import TrafficLight from './TrafficLight.vue'

let popup: Popup | undefined

const created = (scene) => {
  popup = new Popup([0, 0, 0], TrafficLight, {})
  scene.add(popup.scene)
  popup.moveTo([0, 0.5, 0], 10000)
}

// Release the Vue app, the DOM container and the move loop.
onBeforeUnmount(() => {
  popup?.dispose()
  popup = undefined
})
</script>

<style>
.popup {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

#### `TrafficLight.vue`

```vue
<template>
  <div class="traffic-light">
    <div class="light red" :class="{ active: currentLight === 'red' }"></div>
    <div class="light yellow" :class="{ active: currentLight === 'yellow' }"></div>
    <div class="light green" :class="{ active: currentLight === 'green' }"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name: 'TrafficLight',
  setup() {
    const currentLight = ref('red')
    let timer

    const changeLight = () => {
      if (currentLight.value === 'red') {
        currentLight.value = 'green'
      } else if (currentLight.value === 'green') {
        currentLight.value = 'yellow'
      } else if (currentLight.value === 'yellow') {
        currentLight.value = 'red'
      }
    }

    onMounted(() => {
      timer = setInterval(changeLight, 3000)
    })

    onUnmounted(() => {
      clearInterval(timer)
    })

    return {
      currentLight
    }
  }
}
</script>

<style scoped>
.traffic-light {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100px;
  height: 20px;
  background-color: #333;
  border-radius: 4px;
  padding: 4px;
}

.light {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #555;
  transition: background-color 0.5s;
}

.red {
  background-color: #ff4d4d;
}

.yellow {
  background-color: #ffd700;
}

.green {
  background-color: #4caf50;
}

.active {
  background-color: white;
}
</style>
```

:::

## Props

| Name  | Type              | Description                                           |
| ----- | ----------------- | ----------------------------------------------------- |
| scene | THREE.CubeTexture | The cube texture to use for THREE.Scene's background. |

## Methods

| Name        | Parameters                                                                        | Description                                                                       |
| ----------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| constructor | (position: [number, number, number], component: Component, props: object) => void | `props` is the component's props.                                                 |
| moveTo      | (position: [number, number, number], duration: number) => void                    | `duration` is the duration from one position to another. The unit is millisecond. |
| dispose     | () => void                                                                        | Stops the move loop, unmounts the popup component and removes its DOM container.  |
