import * as THREE from 'three'

/**
 * Parameters shared by every scene effect. Keeping them in one place means a
 * single call updates the sun of the sky, ocean, pool and fog consistently.
 */
export interface GlobalParameters {
  /**
   * Normalized world-space direction pointing from the scene towards the sun.
   * Consumed by SkyDome, Water, WaterPool and HeightFog.
   */
  sunDirection: THREE.Vector3
}

type ParameterKey = keyof GlobalParameters

type ParameterListener = (value: unknown, previous: unknown) => void

const DEFAULT_SUN_DIRECTION = new THREE.Vector3(-0.78, 0.2, -0.6).normalize()

const createDefaults = (): GlobalParameters => ({
  sunDirection: DEFAULT_SUN_DIRECTION.clone()
})

/**
 * Observable store for the parameters shared by scene effects.
 *
 * Effects read the current value when they are created and subscribe for
 * updates, so one `set` call keeps every consumer in sync without threading
 * props through the component tree.
 */
export class ParameterBus {
  private values: GlobalParameters = createDefaults()

  private readonly listeners = new Map<ParameterKey, Set<ParameterListener>>()

  /** Returns the current value. Do not mutate it, use `set` instead. */
  get<K extends ParameterKey>(key: K): GlobalParameters[K] {
    return this.values[key]
  }

  /** Stores a new value and notifies the subscribers of that parameter. */
  set<K extends ParameterKey>(key: K, value: GlobalParameters[K]): void {
    const previous = this.values[key]
    const next = (value instanceof THREE.Vector3 ? value.clone().normalize() : value) as GlobalParameters[K]
    this.values[key] = next

    this.listeners.get(key)?.forEach((listener) => listener(next, previous))
  }

  /** Subscribes to one parameter and returns an unsubscribe function. */
  subscribe<K extends ParameterKey>(
    key: K,
    listener: (value: GlobalParameters[K], previous: GlobalParameters[K]) => void
  ): () => void {
    let listeners = this.listeners.get(key)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(key, listeners)
    }
    listeners.add(listener as ParameterListener)

    return () => {
      listeners?.delete(listener as ParameterListener)
      if (listeners?.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  /** Restores every parameter to its default value. */
  reset(): void {
    const previous = this.values
    this.values = createDefaults()

    this.listeners.forEach((listeners, key) => {
      listeners.forEach((listener) => listener(this.values[key], previous[key]))
    })
  }
}

/** Process-wide parameter bus used by all scene effects. */
export const globalParameterBus = new ParameterBus()
