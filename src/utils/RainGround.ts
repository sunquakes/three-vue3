import * as THREE from 'three'

/**
 * Fall progress (0 = top of the rain volume, 1 = bottom) advances this fast per
 * unit of elapsed time. Shared by the shader and by the JS side so the splash
 * lifetime can be expressed in the same unit as the drop animation.
 */
export const RAIN_FALL_RATE = 0.3

/** A splash must be visible for at least a moment ... */
const MIN_SPLASH_WINDOW = 0.01
/** ... but never outlive a full fall cycle, otherwise it wraps into the next one. */
const MAX_SPLASH_WINDOW = 0.35

/** Fraction of the rain volume height a height map may lift the ground. */
const DEFAULT_HEIGHT_MAP_RATIO = 0.4

export interface RainGroundInput {
  height: number
  range: number
  splashDuration: number
  speed: number
  groundHeight?: number | undefined
  heightMapAmplitude?: number | undefined
  heightMapSize?: number | undefined
}

export interface RainGround {
  /** World Y of the lowest point of the ground. */
  base: number
  /** Vertical extent added on top of `base` by the height map. */
  amplitude: number
  /** World size covered by the height map, centred on the origin. */
  mapSize: number
  /** Splash lifetime in fall-cycle units. */
  splashWindow: number
}

/**
 * Resolve the ground/splash parameters shared by the rain and the splash
 * shaders. Keeping the derivation in one place makes the defaults (and their
 * clamps) testable without a GPU.
 */
export function resolveRainGround(input: RainGroundInput): RainGround {
  const height = Math.max(input.height, 0.001)
  return {
    base: input.groundHeight ?? -height / 2,
    amplitude: Math.max(input.heightMapAmplitude ?? height * DEFAULT_HEIGHT_MAP_RATIO, 0),
    mapSize: Math.max(input.heightMapSize ?? input.range, 0.001),
    splashWindow: splashProgressWindow(input.splashDuration, input.speed)
  }
}

/**
 * Convert a splash lifetime in seconds into fall-cycle units. Drops with a
 * higher per-particle speed complete a cycle faster, so the shader divides this
 * window by the particle speed to keep the splash duration in wall-clock time.
 */
export function splashProgressWindow(duration: number, speed: number): number {
  const window = Math.max(duration, 0) * RAIN_FALL_RATE * Math.max(speed, 0)
  return THREE.MathUtils.clamp(window, MIN_SPLASH_WINDOW, MAX_SPLASH_WINDOW)
}

/**
 * 1x1 zero height map used when no map is supplied. The shaders always sample a
 * height map, so a constant zero sample keeps the ground flat at `base` without
 * branching in the vertex stage.
 */
export function createFlatHeightMap(): THREE.DataTexture {
  const map = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  map.needsUpdate = true
  return map
}
