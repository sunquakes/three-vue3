import {
  Mesh,
  Group,
  Object3D,
  AnimationMixer,
  AnimationClip,
  AnimationAction,
  LoopOnce,
  LoopRepeat,
  LoopPingPong
} from 'three'

export default class Animation {
  /**
   * AnimationMixer instance.
   * @defaultValue `new AnimationMixer(mesh)`
   */
  mixer: AnimationMixer

  /**
   * Array with object's animation clips.
   * @defaultValue `[]`
   */
  animations: AnimationClip[]

  /**
   * Animation loop type.
   * @defaultValue `LoopRepeat`
   */
  loop: typeof LoopOnce | typeof LoopRepeat | typeof LoopPingPong = LoopRepeat

  /**
   * Animation delta time.
   * @defaultValue `0.016`
   */
  deltaTime: number = 0.016

  /**
   * Current animation action index.
   * @defaultValue `0`
   */
  index: number = 0

  /**
   * Array with object's animation actions.
   * @defaultValue `[]`
   */
  clipActions: AnimationAction[] = []

  /**
   * Current animation action.
   * @defaultValue `null`
   */
  clipAction: AnimationAction | null = null

  /**
   * Animation loop status.
   * @defaultValue `false`
   */
  isAnimating: boolean = false

  private animationId: number | null = null

  constructor(obj: Mesh | Group | Object3D, animations?: AnimationClip[]) {
    this.mixer = new AnimationMixer(obj)
    if (animations) {
      this.animations = animations
    } else if ('animations' in obj && Array.isArray(obj.animations)) {
      this.animations = obj.animations as AnimationClip[]
    } else {
      this.animations = []
    }
  }

  /**
   * Set animation by index.
   * @param index - Animation index.
   */
  set(index: number): Animation {
    this.index = index
    this.clipAction = null
    return this
  }

  /**
   * Set animation by name.
   * @param name - Animation name.
   */
  setByName(name: string): Animation {
    this.index = this.animations.findIndex((clip) => clip.name === name)
    this.clipAction = null
    return this
  }

  /**
   * Set animation loop type.
   * @param loop - Animation loop type.
   */
  setLoop(loop: typeof LoopOnce | typeof LoopRepeat | typeof LoopPingPong): Animation {
    this.setProperty('loop', loop)
    this.loop = loop
    return this
  }

  /**
   * Set animation time scale.
   * @param timeScale - Animation time scale.
   */
  setTimeScale(timeScale: number): Animation {
    this.setProperty('timeScale', timeScale)
    return this
  }

  /**
   * Set clamp when finished.
   * @param clampWhenFinished - Clamp when finished.
   */
  setClampWhenFinished(clampWhenFinished: boolean) {
    this.setProperty('clampWhenFinished', clampWhenFinished)
    return this
  }

  /**
   * Set property by name and value.
   * @param propertyName - Name of the property to set.
   * @param value - Value to set for the property.
   */
  setProperty(propertyName: string, value: unknown): void {
    if (this.clipAction) {
      if (propertyName in this.clipAction) {
        ;(this.clipAction as unknown as Record<string, unknown>)[propertyName] = value
      }
    }
    if (this.clipActions.length > 0) {
      this.clipActions.forEach((action) => {
        if (propertyName in action) {
          ;(action as unknown as Record<string, unknown>)[propertyName] = value
        }
      })
    }
  }

  /**
   * Play animation.
   */
  play(): void {
    if (this.clipAction) {
      this.clipAction.play()
    } else if (this.animations.length > 0) {
      const action = this.mixer.clipAction(this.animations[this.index])
      action.loop = this.loop
      action.play()
      this.clipAction = action
    } else {
      throw new Error('No animations found')
    }
    this.animate()
  }

  /**
   * Play all animations.
   */
  playAll(): void {
    if (this.clipActions.length > 0) {
      this.clipActions.forEach((action) => {
        action.play()
      })
    } else if (this.animations.length > 0) {
      this.animations.forEach((clip) => {
        const action = this.mixer.clipAction(clip)
        action.loop = this.loop
        action.play()
        this.clipActions.push(action)
      })
    } else {
      throw new Error('No animations found')
    }
    this.animate()
  }

  /**
   * Animation loop.
   */
  animate() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.mixer.update(this.deltaTime)
    }
    if (!this.isAnimating) {
      this.isAnimating = true
      animate()
    }
  }

  /**
   * Stop animation.
   */
  stop(): void {
    if (this.clipAction) {
      this.clipAction.stop()
    }
  }

  /**
   * Stop all animations.
   */
  stopAll(): void {
    if (this.clipActions.length > 0) {
      this.clipActions.forEach((action) => {
        action.stop()
      })
    }
  }

  /**
   * Pause animation.
   */
  pause(): void {
    if (this.clipAction) {
      this.clipAction.paused = true
    }
  }

  /**
   * Pause all animations.
   */
  pauseAll(): void {
    if (this.clipActions.length > 0) {
      this.clipActions.forEach((action) => {
        action.paused = true
      })
    }
  }

  /**
   * Dispose animation and release resources.
   */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.isAnimating = false
    this.stopAll()
    this.mixer.stopAllAction()
    this.clipActions = []
    this.clipAction = null
  }
}
