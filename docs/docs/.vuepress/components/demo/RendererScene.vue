<!--
  Docs-side wrapper around the library `<tv-scene>`.

  The docs site registers this component under the `tv-scene` name so every demo
  on the site follows the single WebGPU / WebGL switch in `RendererSwitch.vue`.
  Changing the renderer remounts the scene, because the runtime cannot swap
  backends in place.
-->
<template>
  <component
    :is="SceneComponent"
    :key="rendererType"
    v-bind="$attrs"
    :renderer-type="rendererType"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { Scene as SceneComponent } from 'three-vue3'
import { rendererType, sceneMounted } from './rendererState'

defineOptions({ inheritAttrs: false })

let release: (() => void) | undefined

onMounted(() => {
  release = sceneMounted()
})

onBeforeUnmount(() => {
  release?.()
  release = undefined
})
</script>
