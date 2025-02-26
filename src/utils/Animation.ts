import * as THREE from 'three'

export default class Animation {
  /**
   * THREE.AnimationMixer instance.
   * @defaultValue `new THREE.AnimationMixer(mesh)`
   */
  mixer: THREE.AnimationMixer

  /**
   * Array with object's animation clips.
   * @defaultValue `[]`
   */
  animations: THREE.AnimationClip[]

  /**
   * Animation loop type.
   * @defaultValue `THREE.LoopOnce`
   */
  loop: typeof THREE.LoopOnce | typeof THREE.LoopRepeat | typeof THREE.LoopPingPong =
    THREE.LoopRepeat

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
  clipActions: THREE.AnimationAction[] = []

  /**
   * Current animation action.
   * @defaultValue `null`
   */
  clipAction: THREE.AnimationAction | null = null

  /**
   * Animation loop status.
   * @defaultValue `false`
   */
  isAnimating: boolean = false

  constructor(mesh: THREE.Mesh) {
    this.mixer = new THREE.AnimationMixer(mesh)
    this.animations = mesh.animations
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
  setLoop(
    loop: typeof THREE.LoopOnce | typeof THREE.LoopRepeat | typeof THREE.LoopPingPong
  ): Animation {
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
  setProperty(propertyName: string, value: any): void {
    if (this.clipAction) {
      if (propertyName in this.clipAction) {
        ;(this.clipAction as any)[propertyName] = value
      }
    }
    if (this.clipActions.length > 0) {
      this.clipActions.forEach((action) => {
        if (propertyName in action) {
          ;(action as any)[propertyName] = value
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
      requestAnimationFrame(animate)
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
}
