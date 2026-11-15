---
lang: zh-CN
title: 弹出窗口
---

::: tip 类型
类
:::

## 默认用法

<Popup />

::: details 点击我查看代码

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

// 释放 Vue 应用、DOM 容器与移动循环。
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

## 属性

| 名称  | 类型              | 描述                                |
| ----- | ----------------- | ----------------------------------- |
| scene | THREE.CubeTexture | 用于 THREE.Scene 背景的立方体纹理。 |

## 方法

| 名称        | 参数                                                                              | 描述                                                        |
| ----------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| constructor | (position: [number, number, number], component: Component, props: object) => void | `props` 是组件的属性。                                      |
| moveTo      | (position: [number, number, number], duration: number) => void                    | `duration` 是从一个位置移动到另一个位置的时间，单位是毫秒。 |
| dispose     | () => void                                                                        | 停止移动循环，卸载弹窗组件并移除其 DOM 容器。               |
