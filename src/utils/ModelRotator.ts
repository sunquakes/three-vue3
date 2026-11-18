import * as THREE from 'three'

export interface ModelRotatorOptions {
  /** Rotation axis, default: 'y' */
  axis?: 'x' | 'y' | 'z'
  /** Rotation speed in radians per second, default: 0.5 */
  speed?: number
  /** Auto-start rotation, default: true */
  autoStart?: boolean
}

class ModelRotator {
  private target: THREE.Object3D
  private axis: 'x' | 'y' | 'z'
  private speed: number
  private isRotating: boolean = false
  private animationId: number | null = null
  private lastTime: number = 0

  constructor(target: THREE.Object3D, options: ModelRotatorOptions = {}) {
    const { axis = 'y', speed = 0.5, autoStart = true } = options

    this.target = target
    this.axis = axis
    this.speed = speed

    if (autoStart) {
      this.play()
    }
  }

  /** Internal animation loop */
  private animate = (time: number) => {
    this.animationId = requestAnimationFrame(this.animate)

    if (!this.isRotating) return

    const delta = (time - this.lastTime) / 1000
    this.lastTime = time

    const rotationDelta = this.speed * delta

    switch (this.axis) {
      case 'x':
        this.target.rotation.x += rotationDelta
        break
      case 'y':
        this.target.rotation.y += rotationDelta
        break
      case 'z':
        this.target.rotation.z += rotationDelta
        break
    }
  }

  /** Start or resume rotation */
  play() {
    if (this.isRotating) return

    this.isRotating = true
    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame(this.animate)
  }

  /** Pause rotation */
  pause() {
    this.isRotating = false
  }

  /** Stop rotation and reset to initial state */
  stop() {
    this.pause()
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.target.rotation.x = 0
    this.target.rotation.y = 0
    this.target.rotation.z = 0
  }

  /** Set rotation speed */
  setSpeed(speed: number) {
    this.speed = speed
  }

  /** Set rotation axis */
  setAxis(axis: 'x' | 'y' | 'z') {
    this.axis = axis
  }

  /** Dispose rotator and stop animation */
  dispose() {
    this.stop()
  }
}

export default ModelRotator
