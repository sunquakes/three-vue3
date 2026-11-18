---
lang: zh-CN
title: 星云星系
---

::: tip 类型
类
:::

`NebulaGalaxy` 用叠加发光的公告板粒子、程序化星云雾面和扩散点击波纹构建一个四臂旋涡星系。每颗恒星都有各自的自转角速度，因此旋臂会被剪切、缠绕，而不是像刚体圆盘一样整体旋转；雾面略微滞后于粒子，图案就不会像一张贴图。

星系自带交互：拖拽倾斜圆盘，滚轮或双指缩放，点击则从核心沿旋臂发出一次光波。指针监听会在首次渲染时绑定到画布，并在 `dispose()` 时移除。

星系由自身动画循环驱动——自转、空闲旋转、倾斜与缩放的平滑、调色板过渡以及点击波都无需逐帧代码。如果需要手动驱动时钟，`update(delta)` 仍然可用。

## 默认用法

<NebulaGalaxyDemo />

::: details 点击我查看代码

```vue
<template>
  <div>
    <div class="toolbar">
      <button
        v-for="item in palettes"
        :key="item.value"
        type="button"
        class="palette"
        :class="{ active: palette === item.value }"
        @click="palette = item.value"
      >
        <span class="swatch" :style="{ background: item.swatch }"></span>
        {{ item.label }}
      </button>
      <label class="speed">
        速度
        <input v-model.number="speed" type="range" min="0" max="2" step="0.1" />
      </label>
      <button type="button" class="pause" @click="paused = !paused">
        {{ paused ? '继续' : '暂停' }}
      </button>
    </div>
    <p class="hint">拖拽倾斜圆盘，滚轮或双指缩放，点击发出光波。</p>
    <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { NebulaGalaxy } from 'three-vue3'
import type { GalaxyPalette } from 'three-vue3'

const palettes: Array<{ value: GalaxyPalette; label: string; swatch: string }> = [
  {
    value: 'violet-gold',
    label: 'Violet gold',
    swatch: 'linear-gradient(135deg, #ffe0a8, #b07cff 55%, #4a7dff)'
  },
  {
    value: 'aurora',
    label: 'Aurora',
    swatch: 'linear-gradient(135deg, #d6fff2, #35e0a8 55%, #4f8bff)'
  },
  {
    value: 'warm-flame',
    label: 'Warm flame',
    swatch: 'linear-gradient(135deg, #fff0c0, #ff9448 55%, #ff4d6d)'
  }
]

const palette = ref<GalaxyPalette>('violet-gold')
const speed = ref(1)
const paused = ref(false)

let effect: NebulaGalaxy | undefined

const created = (scene, { camera, controls, gridHelper }) => {
  camera.position.set(0, 2.6, 11)
  camera.lookAt(0, 0, 0)

  // 星系自己处理指针，避免轨道控制器抢占事件。
  if (controls) controls.enabled = false
  if (gridHelper && typeof gridHelper !== 'boolean') gridHelper.visible = false

  effect = new NebulaGalaxy({ palette: palette.value, speed: speed.value })
  scene.add(effect)
}

watch(palette, (value) => effect?.setPalette(value))
watch(speed, (value) => effect?.setSpeed(value))
watch(paused, (value) => effect?.setPaused(value))

onBeforeUnmount(() => {
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
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.palette,
.pause {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
  cursor: pointer;
  color: inherit;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
}
.palette.active {
  border-color: var(--vp-c-brand-1);
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.speed {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.speed input {
  width: 90px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  opacity: 0.6;
}
</style>
```

:::

## 配置项

| 名称            | 类型          | 默认值          | 描述                                                  |
| --------------- | ------------- | --------------- | ----------------------------------------------------- |
| arms            | number        | `4`             | `可选` 旋臂数量。                                      |
| armStars        | number        | `26000`         | `可选` 构成旋臂的恒星数量。                            |
| coreStars       | number        | `4800`          | `可选` 填充核心的恒星数量。                            |
| dustStars       | number        | `4400`          | `可选` 柔化边缘的大颗暗淡恒星数量。                    |
| backgroundStars | number        | `780`           | `可选` 星系体之外的远景背景星数量。                    |
| radius          | number        | `5.15`          | `可选` 星系半径（世界单位）。                          |
| armTightness    | number        | `1.12`          | `可选` 旋臂随距离缠绕的紧密程度。                      |
| palette         | GalaxyPalette | `'violet-gold'` | `可选` 配色方案。                                      |
| speed           | number        | `1`             | `可选` 自转速度倍数。                                  |
| autoRotate      | boolean       | `true`          | `可选` 空闲时缓慢旋转（减少动态效果时为 off）。        |
| interaction     | boolean       | `true`          | `可选` 在画布上启用拖拽 / 滚轮 / 双指交互。            |
| pulse           | boolean       | `true`          | `可选` 点击波纹（减少动态效果时为 off）。              |
| hazeOpacity     | number        | `0.95`          | `可选` 雾面层的不透明度。                              |
| followSpeed     | number        | `5.8`           | `可选` 倾斜、缩放和配色过渡的平滑速度。                |
| maxTiltX        | number        | `1.15`          | `可选` 最大垂直倾斜（弧度）。                          |
| maxTiltY        | number        | `1.25`          | `可选` 最大水平倾斜（弧度）。                          |
| minZoom         | number        | `0.62`          | `可选` 最小缩放系数。                                  |
| maxZoom         | number        | `1.55`          | `可选` 最大缩放系数。                                  |
| seed            | number        | `7`             | `可选` 确定性星点分布的随机种子。                      |

## 类用法

```ts
import { NebulaGalaxy } from 'three-vue3'

const galaxy = new NebulaGalaxy({ palette: 'violet-gold' })
scene.add(galaxy)

// 星系会自动播放动画。只有需要手动驱动时才调用 update(delta)：
galaxy.update(delta)

// 切换配色、暂停自转或发出光波：
galaxy.setPalette('aurora')
galaxy.setPaused(true)
galaxy.pulse()

// 销毁时：
galaxy.dispose()
```
