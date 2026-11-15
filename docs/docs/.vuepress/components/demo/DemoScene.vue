<!--
  `/demo` page shell. It mounts the Martian scene and lays out the r3l
  overlays: the info card, the WebGPU/WebGL switch, the caption line, the
  orbit hint, the credits and the DSN downlink monitor.
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
        @pip-opacity="pipOpacity = $event"
      />
    </tv-scene>

    <section class="demo-panel demo-panel--info">
      <a class="demo-back" :href="props.docsLink">← Back to Guide</a>
      <h1 class="demo-title">A Martian Adventure</h1>
      <p class="demo-blurb">
        Qiusuo the rover rolls across the rust-red dunes toward an impact crater, parks at the rim
        beside the Deep Space Network relay station, and streams its data toward the pale blue Earth
        in the black sky, while a fern patch opens up in the regolith beside it.
      </p>
    </section>

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

    <div class="demo-caption">{{ caption }}</div>

    <div class="demo-panel demo-panel--hint">Drag to orbit · Scroll to zoom</div>

    <div class="demo-credits">3D models: NASA/JPL-Caltech · fern patch by Poly Haven (CC0)</div>

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

const props = defineProps<{
  homeLink?: string
  docsLink?: string
  aiLink?: string
}>()

const caption = ref('')
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

.demo-panel--info {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 1000;
  padding: 16px 20px;
  max-width: 330px;
  pointer-events: auto;
}

.demo-back {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  color: #ffb066;
}

.demo-title {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
  font-weight: 800;
  color: #ffe3c4;
  letter-spacing: 0.01em;
}

.demo-blurb {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #d8b59a;
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
  max-width: min(90vw, 720px);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #fff;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  white-space: nowrap;
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
}

.demo-credits {
  position: absolute;
  bottom: 20px;
  right: 24px;
  z-index: 1000;
  font-size: 11px;
  color: rgba(232, 196, 166, 0.7);
  text-align: right;
}
</style>
