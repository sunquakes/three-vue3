<!--
  `/demo` page shell. It mounts the Martian scene and lays out the r3l
  overlays: the compact Home link, the WebGPU/WebGL switch, the caption line,
  the orbit hint and the DSN downlink monitor.
-->
<template>
  <main class="demo-page">
    <tv-scene
      class="demo-canvas"
      bg-color="rgb(16, 8, 8)"
      :axes-helper="false"
      :grid-helper="false"
    >
      <MartianDemo
        :captions="captions"
        @caption="caption = $event"
        @caption-opacity="captionOpacity = $event"
        @pip-opacity="pipOpacity = $event"
      />
    </tv-scene>

    <a class="demo-panel demo-home" :href="homeLink">← Home</a>

    <div class="demo-panel demo-panel--switch">
      <button
        type="button"
        class="demo-switch"
        :class="{ 'demo-switch--active': rendererType === 'webgpu' }"
        @click="setRendererType('webgpu')"
      >
        WebGPU
      </button>
      <button
        type="button"
        class="demo-switch"
        :class="{ 'demo-switch--active': rendererType === 'webgl' }"
        @click="setRendererType('webgl')"
      >
        WebGL
      </button>
    </div>

    <div class="demo-caption" :style="{ opacity: captionOpacity }">{{ caption }}</div>

    <div class="demo-panel demo-panel--hint">Drag to orbit · Scroll to zoom</div>

    <DownlinkMonitor :opacity="pipOpacity" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MartianDemo from './MartianDemo.vue'
import DownlinkMonitor from './DownlinkMonitor.vue'
import { rendererType, setRendererType } from './rendererState'

interface MartianCaptions {
  intro: string
  survey: string
  driving: string
  parked: string
  acquiring: string
  finding: string
  downlink: string
}

const { homeLink } = defineProps<{
  homeLink?: string
  docsLink?: string
  aiLink?: string
}>()

const caption = ref('')
const captionOpacity = ref(1)
const pipOpacity = ref(0)

const captions: MartianCaptions = {
  intro: 'Qiusuo · Mars Dream',
  survey: 'Survey stop · Sampling the regolith',
  driving: 'SOL 118 · Searching the dune plain',
  parked: 'Parked at the crater rim',
  acquiring: 'Acquiring the Deep Space Network downlink',
  finding: 'Something green in the regolith',
  downlink: "Downlink locked · streaming Qiusuo's data to Earth"
}
</script>

<style scoped>
.demo-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  padding: 0;
  margin: 0;
  background: rgb(16, 8, 8);
}

.demo-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.demo-panel {
  background: rgba(18, 9, 8, 0.62);
  border: 1px solid rgba(255, 176, 102, 0.28);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.demo-home {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 1000;
  display: inline-block;
  padding: 16px 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  color: #ffb066;
  pointer-events: auto;
}

.demo-panel--switch {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 1000;
  padding: 8px;
  display: flex;
  gap: 6px;
}

.demo-switch {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #f0c9a6;
  background: rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;
}

.demo-switch--active {
  color: #1a0f00;
  background: linear-gradient(180deg, #ffb066 0%, #e6641a 100%);
}

.demo-caption {
  position: absolute;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  max-width: min(720px, calc(100vw - 48px));
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #fff;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  white-space: normal;
  transition: opacity 450ms ease;
}

.demo-panel--hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  padding: 6px 14px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: rgba(232, 196, 166, 0.85);
  white-space: nowrap;
  pointer-events: none;
}
</style>
