<!--
  The DSN downlink picture-in-picture: it fades in when the rover's beam to
  Earth goes live, then decodes like a live feed (sweep, ping, frame counter)
  and can be resized, zoomed and panned.
-->
<template>
  <div
    class="monitor"
    :class="{ 'monitor--hover': hover, 'monitor--dragging': dragging }"
    :style="{
      width: expanded ? '460px' : '288px',
      opacity,
      pointerEvents: live ? 'auto' : 'none',
      cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'pointer'
    }"
    role="button"
    :tabindex="live ? 0 : -1"
    aria-label="Earth downlink monitor: click to resize, scroll to zoom, drag to pan"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @click="handleToggle"
    @dblclick.stop="resetView"
  >
    <div class="monitor__header">
      <span class="monitor__beacon"></span>
      DSN · DEEP SPACE NETWORK
      <button
        type="button"
        class="monitor__band"
        aria-label="Cycle spectral band"
        @click.stop="band = (band + 1) % SPECTRUM_BANDS.length"
        @pointerdown.stop
      >
        {{ SPECTRUM_BANDS[band].label }}
      </button>
    </div>

    <div
      ref="viewportRef"
      class="monitor__viewport"
      :style="{ touchAction: zoom > 1 ? 'none' : 'auto' }"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="reticle = null"
      @click="handleViewportClick"
    >
      <img
        class="monitor__photo"
        src="/images/earth/earth-apollo17.jpg"
        alt="Earth from space"
        draggable="false"
        :style="photoStyle"
      />
      <div class="monitor__scanlines"></div>

      <template v-if="live">
        <div class="monitor__sweep"></div>
        <div class="monitor__ping"></div>
      </template>

      <div v-if="hover" class="monitor__hint">
        {{ zoom > 1 ? 'DOUBLE-CLICK TO RESET' : 'SCROLL TO ZOOM · DRAG TO PAN' }}
      </div>

      <div
        v-if="reticle"
        class="monitor__reticle"
        :style="{ left: `${reticle.x}%`, top: `${reticle.y}%` }"
      >
        <span class="monitor__cross monitor__cross--v"></span>
        <span class="monitor__cross monitor__cross--h"></span>
      </div>

      <div class="monitor__overlay">
        <span class="monitor__tag">EARTH · LIVE</span>
        <span v-if="reticle" class="monitor__coords">
          {{ latitude >= 0 ? 'N' : 'S' }} {{ Math.abs(latitude).toFixed(1) }}° ·
          {{ longitude >= 0 ? 'E' : 'W' }} {{ Math.abs(longitude).toFixed(1) }}°
        </span>
        <div class="monitor__zoom" @pointerdown.stop @click.stop>
          <button type="button" aria-label="Zoom out" @click="zoomBy(-0.25)">−</button>
          <span>{{ zoom.toFixed(2) }}×</span>
          <button type="button" aria-label="Zoom in" @click="zoomBy(0.25)">+</button>
        </div>
      </div>
    </div>

    <div class="monitor__receive">
      <span class="monitor__receive-dot"></span>
      RECEIVING
      <div class="monitor__bars">
        <span v-for="index in 4" :key="index" :style="barStyle(index - 1)"></span>
      </div>
      <span class="monitor__frame">
        FRM {{ String(frame % 10000).padStart(4, '0') }} · 8.42 kbps
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = withDefaults(defineProps<{ opacity?: number }>(), { opacity: 0 })

const SPECTRUM_BANDS = [
  { label: 'VISIBLE', filter: 'none' },
  {
    label: 'THERMAL',
    filter: 'grayscale(1) sepia(1) saturate(2.8) hue-rotate(155deg) contrast(1.15) brightness(1.05)'
  },
  { label: 'RADAR', filter: 'grayscale(1) contrast(1.8) brightness(0.62)' }
]

const clampPan = (x: number, y: number, scale: number) => {
  const limit = ((scale - 1) * 100) / 2
  return {
    x: THREE.MathUtils.clamp(x, -limit, limit),
    y: THREE.MathUtils.clamp(y, -limit, limit)
  }
}

const expanded = ref(false)
const hover = ref(false)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const band = ref(0)
const reticle = ref<{ x: number; y: number } | null>(null)
const dragging = ref(false)
const frame = ref(0)
const viewportRef = ref<HTMLDivElement | null>(null)

const drag = ref<{
  pointerId: number
  x: number
  y: number
  panX: number
  panY: number
  moved: boolean
} | null>(null)
let suppressClick = false
let frameTimer: number | null = null

const live = computed(() => props.opacity > 0)

const longitude = computed(() => (reticle.value ? reticle.value.x * 3.6 - 180 : 0))
const latitude = computed(() => (reticle.value ? 90 - reticle.value.y * 1.8 : 0))

const photoStyle = computed(() => ({
  height: expanded.value ? '280px' : '176px',
  transform: `translate(${pan.value.x}%, ${pan.value.y}%) scale(${zoom.value})`,
  filter: SPECTRUM_BANDS[band.value].filter,
  transition: dragging.value ? 'none' : 'transform 0.28s ease, height 0.35s ease, filter 0.35s ease'
}))

const barStyle = (index: number) => ({
  height: `${4 + index * 2.4}px`,
  animationDelay: `${index * 0.16}s`
})

const zoomBy = (step: number) => {
  zoom.value = THREE.MathUtils.clamp(Number((zoom.value + step).toFixed(2)), 1, 2.5)
}

const resetView = () => {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

const handleToggle = () => {
  if (suppressClick) {
    suppressClick = false
    return
  }
  expanded.value = !expanded.value
}

const handleViewportClick = (event: MouseEvent) => {
  if (zoom.value > 1) event.stopPropagation()
}

const handlePointerDown = (event: PointerEvent) => {
  if (zoom.value <= 1) return
  const target = event.currentTarget as HTMLDivElement
  target.setPointerCapture(event.pointerId)
  drag.value = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y,
    moved: false
  }
  dragging.value = true
}

const handlePointerMove = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLDivElement
  const rect = target.getBoundingClientRect()
  reticle.value = {
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100
  }

  const current = drag.value
  if (!current || current.pointerId !== event.pointerId) return
  const dx = ((event.clientX - current.x) / rect.width) * 100
  const dy = ((event.clientY - current.y) / rect.height) * 100
  if (!current.moved && Math.abs(dx) + Math.abs(dy) > 1) current.moved = true
  if (current.moved) {
    pan.value = clampPan(current.panX + dx, current.panY + dy, zoom.value)
  }
}

const handlePointerUp = (event: PointerEvent) => {
  const current = drag.value
  if (!current) return
  const target = event.currentTarget as HTMLDivElement
  if (target.hasPointerCapture(current.pointerId)) {
    target.releasePointerCapture(current.pointerId)
  }
  drag.value = null
  dragging.value = false
  if (current.moved) suppressClick = true
}

const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  zoom.value = THREE.MathUtils.clamp(
    Number((zoom.value + (event.deltaY < 0 ? 0.25 : -0.25)).toFixed(2)),
    1,
    2.5
  )
}

watch(zoom, (value) => {
  pan.value = value === 1 ? { x: 0, y: 0 } : clampPan(pan.value.x, pan.value.y, value)
})

watch(live, (value) => {
  if (frameTimer !== null) {
    window.clearInterval(frameTimer)
    frameTimer = null
  }
  if (!value) return
  frameTimer = window.setInterval(() => {
    frame.value += 1
  }, 640)
})

onMounted(() => {
  viewportRef.value?.addEventListener('wheel', handleWheel, { passive: false })
})

onBeforeUnmount(() => {
  viewportRef.value?.removeEventListener('wheel', handleWheel)
  if (frameTimer !== null) {
    window.clearInterval(frameTimer)
    frameTimer = null
  }
})
</script>

<style scoped>
.monitor {
  position: absolute;
  left: 24px;
  bottom: 24px;
  z-index: 10;
  background: rgba(10, 24, 36, 0.88);
  border: 1px solid rgba(126, 203, 255, 0.35);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  user-select: none;
  transition:
    opacity 0.8s ease,
    width 0.35s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.monitor--hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.7);
}

.monitor__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(126, 203, 255, 0.22);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #cfeaff;
}

.monitor__beacon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5847;
  box-shadow: 0 0 8px #ff5847;
}

.monitor__band {
  margin-left: auto;
  padding: 2px 7px;
  border: 1px solid rgba(126, 203, 255, 0.45);
  border-radius: 4px;
  background: rgba(5, 18, 28, 0.82);
  color: #aef0ff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  cursor: pointer;
}

.monitor__viewport {
  position: relative;
  line-height: 0;
  overflow: hidden;
}

.monitor__photo {
  width: 100%;
  object-fit: cover;
  display: block;
  transform-origin: center;
}

.monitor__scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 30, 50, 0.28) 3px
  );
  mix-blend-mode: multiply;
  pointer-events: none;
}

.monitor__sweep {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    rgba(126, 203, 255, 0) 0%,
    rgba(170, 238, 255, 0.9) 50%,
    rgba(126, 203, 255, 0) 100%
  );
  box-shadow: 0 0 14px rgba(126, 203, 255, 0.55);
  animation: r3l-downlink-sweep 3.4s linear infinite;
  pointer-events: none;
}

.monitor__ping {
  position: absolute;
  right: 16px;
  top: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(158, 232, 255, 0.9);
  animation: r3l-downlink-ping 1.7s ease-out infinite;
  pointer-events: none;
}

.monitor__hint {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(5, 18, 28, 0.72);
  color: rgba(174, 240, 255, 0.85);
  font-size: 9px;
  letter-spacing: 0.06em;
  white-space: nowrap;
  pointer-events: none;
}

.monitor__reticle {
  position: absolute;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(174, 240, 255, 0.9);
  box-shadow: 0 0 10px rgba(90, 220, 255, 0.55);
  pointer-events: none;
}

.monitor__cross {
  position: absolute;
  background: rgba(174, 240, 255, 0.55);
}

.monitor__cross--v {
  left: 50%;
  top: -6px;
  width: 1px;
  height: 40px;
}

.monitor__cross--h {
  top: 50%;
  left: -6px;
  height: 1px;
  width: 40px;
}

.monitor__overlay {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.monitor__tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(5, 18, 28, 0.78);
  color: #aef0ff;
  font-size: 10px;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.monitor__coords {
  color: rgba(174, 240, 255, 0.85);
  font-size: 9px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.monitor__zoom {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.monitor__zoom button {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 4px;
  border: 1px solid rgba(126, 203, 255, 0.45);
  background: rgba(5, 18, 28, 0.82);
  color: #aef0ff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.monitor__zoom span {
  color: #aef0ff;
  font-size: 9px;
  min-width: 30px;
  text-align: center;
}

.monitor__receive {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 6px;
  border-top: 1px solid rgba(126, 203, 255, 0.18);
  background: rgba(5, 18, 28, 0.55);
  color: #8fe6ff;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1;
}

.monitor__receive-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #66f0c0;
  box-shadow: 0 0 8px #66f0c0;
  animation: r3l-downlink-blink 1.1s steps(1, end) infinite;
}

.monitor__bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}

.monitor__bars span {
  width: 2px;
  border-radius: 1px;
  background: #7ee9ff;
  transform-origin: bottom;
  animation: r3l-downlink-bar 1.2s ease-in-out infinite;
}

.monitor__frame {
  margin-left: auto;
  color: rgba(174, 240, 255, 0.85);
  font-variant-numeric: tabular-nums;
}

@keyframes r3l-downlink-sweep {
  0% {
    top: -6%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    top: 104%;
    opacity: 0;
  }
}

@keyframes r3l-downlink-ping {
  0% {
    transform: scale(0.3);
    opacity: 0.85;
  }
  70% {
    opacity: 0.16;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}

@keyframes r3l-downlink-blink {
  0%,
  55% {
    opacity: 1;
  }
  56%,
  100% {
    opacity: 0.18;
  }
}

@keyframes r3l-downlink-bar {
  0%,
  100% {
    transform: scaleY(0.35);
  }
  40% {
    transform: scaleY(1);
  }
  72% {
    transform: scaleY(0.55);
  }
}
</style>
