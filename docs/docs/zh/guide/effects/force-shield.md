---
lang: zh-CN
title: 力场护盾
---

::: tip 类型
类
:::

`ForceShield` 是包裹球体的六边形力场。三平面六边形网格、菲涅尔边缘、分层流动噪声和逐格闪烁共同构成表面；噪声阈值让外壳可以溶解，从而收放护盾，溶解边缘在移动时会发亮。

`hit(point)` 从世界空间接触点发射冲击环并消耗生命值，`life` 下降时表面会逐渐偏向红色。护盾由自身时钟驱动动画，溶解与冲击环都不需要逐帧代码。

## 默认用法

<ForceShieldDemo />

::: details 点击我查看代码

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

  // 点击力场时，在射线命中处产生冲击。
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

  // 自动冲击让演示持续运动；生命耗尽后重置护盾。
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

## 配置项

| 名称                | 类型                | 默认值     | 描述                                                  |
| ------------------- | ------------------- | ---------- | ----------------------------------------------------- |
| radius              | number              | `1.8`      | `可选` 球体半径。                                      |
| active              | boolean             | `true`     | `可选` 护盾处于展开还是溶解状态。                      |
| reveal              | number              | —          | `可选` 将溶解冻结在该进度（`0` 可见，`1` 完全溶解）。  |
| revealSpeed         | number              | `3.5`      | `可选` 自动溶解动画的速度。                            |
| color               | ColorRepresentation | `0x26aeff` | `可选` 护盾基础颜色。                                  |
| opacity             | number              | `0.76`     | `可选` 表面整体不透明度。                              |
| hexScale            | number              | `3`        | `可选` 六边形网格平铺密度。                            |
| hexOpacity          | number              | `0.13`     | `可选` 六边形单元格亮度。                              |
| showHex             | boolean             | `true`     | `可选` 是否绘制六边形网格。                            |
| edgeWidth           | number              | `0.06`     | `可选` 六边形缝隙宽度。                                |
| fresnelPower        | number              | `1.8`      | `可选` 菲涅尔衰减指数。                                |
| fresnelStrength     | number              | `1.75`     | `可选` 菲涅尔边缘亮度。                                |
| fadeStart           | number              | `0`        | `可选` 低于该 Y 值淡出到地面，`-1` 关闭。              |
| flashSpeed          | number              | `0.6`      | `可选` 单元格闪烁速度。                                |
| flashIntensity      | number              | `0.11`     | `可选` 单元格闪烁亮度。                                |
| noiseScale          | number              | `1.3`      | `可选` 溶解噪声缩放。                                  |
| noiseEdgeColor      | ColorRepresentation | `0x26aeff` | `可选` 溶解边缘颜色。                                  |
| noiseEdgeWidth      | number              | `0.02`     | `可选` 溶解边缘宽度。                                  |
| noiseEdgeIntensity  | number              | `10`       | `可选` 溶解边缘亮度。                                  |
| noiseEdgeSmoothness | number              | `0.5`      | `可选` 溶解边缘锐利度。                                |
| flowScale           | number              | `2.4`      | `可选` 流动噪声缩放。                                  |
| flowSpeed           | number              | `1.13`     | `可选` 流动噪声速度。                                  |
| flowIntensity       | number              | `4`        | `可选` 流动噪声亮度。                                  |
| hitRingSpeed        | number              | `1.75`     | `可选` 冲击环扩散速度。                                |
| hitRingWidth        | number              | `0.12`     | `可选` 冲击环粗细。                                    |
| hitMaxRadius        | number              | `0.85`     | `可选` 冲击环最大角半径。                              |
| hitDuration         | number              | `1.8`      | `可选` 冲击可见的持续秒数。                            |
| hitIntensity        | number              | `4.1`      | `可选` 冲击亮度。                                      |
| hitImpactRadius     | number              | `0.3`      | `可选` 接触高亮的角半径。                              |
| hitDamage           | number              | `5`        | `可选` 每次命中扣除的生命值百分比。                    |
| life                | number              | `1`        | `可选` 初始护盾生命值（`1` 完好，`0` 耗尽）。          |

## 类用法

```ts
import * as THREE from 'three'
import { ForceShield } from 'three-vue3'

const shield = new ForceShield({ radius: 1.8 })
scene.add(shield)

// 溶解与冲击环由护盾自身时钟推进。
// 溶解收起，然后重新展开：
shield.setActive(false)
shield.setActive(true)

// 在世界空间某点触发冲击：
shield.hit(new THREE.Vector3(1, 0.6, 1.2))

// 销毁时：
shield.dispose()
```
