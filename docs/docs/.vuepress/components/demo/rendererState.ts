import { computed, nextTick, ref, watch } from 'vue'

export type RendererType = 'webgpu' | 'webgl'

const STORAGE_KEY = 'three-vue3:renderer'

function readStored(): RendererType {
  if (typeof window === 'undefined') return 'webgpu'
  return window.localStorage.getItem(STORAGE_KEY) === 'webgl' ? 'webgl' : 'webgpu'
}

/** Shared renderer choice for every demo on the docs site. */
export const rendererType = ref<RendererType>(readStored())

export function setRendererType(type: RendererType) {
  if (type === rendererType.value) return

  // Switching remounts the layout, so the page is rebuilt from scratch. Restore
  // the scroll position once the new DOM exists, otherwise the user is thrown
  // back to the top of the page on every toggle.
  const scrollTop = typeof window === 'undefined' ? 0 : window.scrollY

  rendererType.value = type
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, type)
    nextTick(() => {
      requestAnimationFrame(() => window.scrollTo(0, scrollTop))
    })
  }
}

/** Number of scenes currently mounted, used to show the switch only on demo pages. */
const mountedScenes = ref(0)
const hasHadScene = ref(false)

watch(mountedScenes, (count) => {
  if (count > 0) hasHadScene.value = true
})

export const sceneMounted = () => {
  mountedScenes.value += 1
  return () => {
    mountedScenes.value -= 1
  }
}

export const showRendererSwitch = computed(() => mountedScenes.value > 0 || hasHadScene.value)

export const resetRendererSwitch = () => {
  hasHadScene.value = false
}
