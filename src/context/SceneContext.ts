import { inject, onBeforeUnmount } from 'vue'
import type { InjectionKey } from 'vue'

/**
 * Typed injection key for the scene context. Prefer this over the legacy
 * `'sceneSlotProps'` string when writing new components.
 */
export const sceneContextKey: InjectionKey<SceneSlotProps> = Symbol('three-vue3-scene')

/**
 * Read the surrounding `<Scene>` context. Falls back to the legacy string key
 * so components written against older versions keep working.
 */
export function useScene(): SceneSlotProps {
  const context = inject(sceneContextKey, null) ?? inject('sceneSlotProps', null)

  if (!context) {
    throw new Error('[three-vue3] useScene() must be called inside a <Scene> component')
  }

  return context
}

export type FramePhase = 'before' | 'after'

/**
 * Register a per-frame callback on the surrounding scene. The callback is
 * unregistered automatically when the calling component unmounts.
 *
 * @returns an unsubscribe function for manual teardown
 */
export function useFrame(callback: CallbackFrame, phase: FramePhase = 'before'): () => void {
  const context = useScene()
  const add = phase === 'before' ? context.addBeforeFrame : context.addAfterFrame

  if (!add) {
    return () => {}
  }

  const remove = add(callback)
  onBeforeUnmount(remove)

  return remove
}
