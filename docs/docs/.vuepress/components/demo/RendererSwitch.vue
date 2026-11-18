<!--
  Renderer toolbar shown at the top of every page that mounts a scene.

  The choice lives in `rendererState`; scenes remount when it changes. The
  Martian demo page renders its own switch in the top-right corner, so this
  toolbar stays hidden there.
-->
<template>
  <div v-if="visible" class="renderer-switch">
    <div class="renderer-switch__info">
      <span class="renderer-switch__title">{{ labels.title }}</span>
      <span class="renderer-switch__hint">{{ labels.hint }}</span>
    </div>
    <div class="renderer-switch__options" role="group" :aria-label="labels.title">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="renderer-switch__button"
        :class="{ 'is-active': rendererType === option.value }"
        :aria-pressed="rendererType === option.value"
        @click="setRendererType(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue'
import { usePageData } from 'vuepress/client'
import {
  rendererType,
  resetRendererSwitch,
  setRendererType,
  showRendererSwitch
} from './rendererState'

const options = [
  { value: 'webgpu' as const, label: 'WebGPU' },
  { value: 'webgl' as const, label: 'WebGL' }
]

const page = usePageData()

watch(
  () => page.value.path,
  () => resetRendererSwitch()
)

// The Martian demo renders its own switch in the top-right corner, and the AI
// agent guide is reference-only, so the toolbar stays hidden on those pages.
const hidden = computed(
  () =>
    /(^|\/)demo\.html$/.test(page.value.path) || /^\/(zh\/)?ai(\/|\.html|$)/.test(page.value.path)
)

const visible = computed(() => showRendererSwitch.value && !hidden.value)

const labels = computed(() =>
  page.value.path.startsWith('/zh/')
    ? {
        title: '渲染器',
        hint: 'WebGPU（默认）或 WebGL，切换后对比效果'
      }
    : {
        title: 'Renderer',
        hint: 'WebGPU (default) or WebGL — switch to compare'
      }
)
</script>

<style scoped>
.renderer-switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 1.25rem 0 1.75rem;
  padding: 10px 12px 10px 16px;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-alt);
}

.renderer-switch__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.renderer-switch__title {
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.renderer-switch__hint {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.5;
}

.renderer-switch__options {
  display: flex;
  flex: none;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg);
}

.renderer-switch__button {
  padding: 6px 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.renderer-switch__button:hover {
  color: var(--vp-c-text-1);
}

.renderer-switch__button.is-active {
  background: #5b6bd6;
  color: #fff;
  box-shadow: 0 2px 10px rgba(91, 107, 214, 0.32);
}

@media (max-width: 640px) {
  .renderer-switch {
    gap: 10px;
    margin-bottom: 1.25rem;
    padding: 8px 8px 8px 12px;
  }

  .renderer-switch__hint {
    display: none;
  }

  .renderer-switch__button {
    padding: 6px 10px;
  }
}
</style>
