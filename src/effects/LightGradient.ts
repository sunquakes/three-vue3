// Import from 'three/webgpu' so light classes match the classes registered in
// the WebGPURenderer node library. 'three' and 'three/webgpu' are two separate
// builds with distinct class identities; lights created from 'three' are never
// found by LightsNode.setupNodeLights ("Light node not found") and silently
// have no effect on rendering.
import * as THREE from 'three/webgpu'

/**
 * Gradient animation options for light transition.
 */
export interface LightGradientOptions {
  /** Target color (hex string or number) */
  color?: string | number
  /** Target intensity */
  intensity?: number
  /** Duration of the gradient animation in milliseconds */
  duration?: number
  /** Callback when animation completes */
  onComplete?: () => void
}

/**
 * Animate light properties from current values to target values.
 *
 * @example
 * ```ts
 * import { LightGradient } from 'three-vue3'
 *
 * const gradient = new LightGradient(light, {
 *   color: '#ff0000',
 *   intensity: 10,
 *   duration: 2000
 * })
 *
 * // Later, to cancel:
 * gradient.dispose()
 * ```
 */
export class LightGradient {
  private targets: Array<THREE.Light>
  private startColors: THREE.Color[]
  private endColors: THREE.Color[]
  private startIntensities: number[]
  private endIntensities: number[]
  private duration: number
  private startTime: number
  private animationId: number | null = null
  private completed = false
  private onComplete?: () => void

  constructor(light: THREE.Light | THREE.Object3D, options: LightGradientOptions = {}) {
    const { color: targetColor, intensity: targetIntensity, duration = 1000, onComplete } = options

    // Support both single Light and Group (Object3D with Light children).
    const collected: THREE.Light[] = []
    if ((light as THREE.Light).isLight) {
      collected.push(light as THREE.Light)
    } else if (light instanceof THREE.Object3D) {
      light.traverse((child) => {
        if ((child as THREE.Light).isLight) {
          collected.push(child as THREE.Light)
        }
      })
    }
    if (collected.length === 0) {
      throw new Error('[LightGradient] No THREE.Light instance(s) found on the provided target.')
    }
    this.targets = collected
    this.startColors = this.targets.map((t) => t.color.clone())
    this.endColors = this.targets.map(() =>
      targetColor ? new THREE.Color(targetColor) : this.startColors[0].clone()
    )
    this.startIntensities = this.targets.map((t) => t.intensity)
    this.endIntensities = this.targets.map(() => targetIntensity ?? this.startIntensities[0])
    this.duration = duration
    this.startTime = performance.now()
    this.onComplete = onComplete

    this.animate()
  }

  private animate = () => {
    const elapsed = performance.now() - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)

    // Ease out cubic for smooth transition
    const easedProgress = 1 - Math.pow(1 - progress, 3)

    // Interpolate every collected light in parallel.
    for (let i = 0; i < this.targets.length; i++) {
      this.targets[i].color.copy(this.startColors[i]).lerp(this.endColors[i], easedProgress)
      this.targets[i].intensity =
        this.startIntensities[i] +
        (this.endIntensities[i] - this.startIntensities[i]) * easedProgress
    }

    if (progress < 1) {
      this.animationId = requestAnimationFrame(this.animate)
    } else {
      this.completed = true
      this.animationId = null
      this.onComplete?.()
    }
  }

  /**
   * Stop the gradient animation and release resources.
   */
  dispose(): void {
    if (this.animationId !== null && !this.completed) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }
}

export default LightGradient
