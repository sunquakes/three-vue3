import { createApp, type App, type Component, type ComponentPublicInstance } from 'vue'
import { generateUUID } from './UUID'

import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export default class Popup {

  /**
   * The Three.js CSS2DObject of the popup.
   */
  public scene: CSS2DObject | undefined

  /**
   * The id of the popup html element.
   */
  private id: string

  /**
   * The start timestamp of the popup movement.
   */
  private start: number | undefined

  /**
   * The duration of the popup move from the current position to the target position, the unit is millisecond.
   */
  private duration: number

  /**
   * The delta in the x-axis direction.
   */
  private deltaX: number

  /**
   * The delta in the y-axis direction.
   */
  private deltaY: number

  /**
   * The delta in the z-axis direction.
   */
  private deltaZ: number

  /**
   * The state of popup movement.
   */
  private state: Boolean

  /**
   * Position of popup window display
   */
  private position: Position

  /**
   * Popup component instance.
   */
  component: ComponentPublicInstance

  /**
   * Vue app that renders the popup component.
   */
  private app: App | undefined

  /**
   * Animation frame ID of the move loop.
   */
  private animationId: number | null = null

  constructor(position: Position, component: Component, props: object) {
    this.id = 'popup-' + generateUUID()
    this.duration = 0
    this.deltaX = 0.0
    this.deltaY = 0.0
    this.deltaZ = 0.0
    this.state = false
    this.position = position
    this.component = this.create(position, component, props)
    this.update = this.update.bind(this)
  }

  /**
   * Create the popup.
   * @param position 
   * @param component 
   * @param props 
   * @returns 
   */
  create(position: Position, component: Component, props: object | {}): ComponentPublicInstance {
    if (this.component) {
      return this.component
    }
    let containerElement = document.getElementById(this.id)
    if (containerElement == undefined) {
      containerElement = document.createElement('div')
      containerElement.setAttribute('id', this.id)
      document.body.append(containerElement)
    }
    this.scene = new CSS2DObject(containerElement)
    this.scene.position.set(...position)
    const app = createApp(component, props || {})
    this.app = app
    return app.mount(`#${this.id}`)
  }

  /**
   * Move the popup to the specified position.
   * @param position 
   * @param duration 
   */
  moveTo(position: Position, duration: number) {
    this.duration += duration
    this.deltaX += position[0] - this.position[0]
    this.deltaY += position[1] - this.position[1]
    this.deltaZ += position[2] - this.position[2]
    this.position = position
    if (this.state === false) {
      this.state = true
      this.animationId = requestAnimationFrame(this.update)
    }
  }

  /**
   * Update the position of the popup.
   * @param timestamp 
   */
  update(timestamp: number) {
    if (this.start === undefined) {
      this.start = timestamp
    }
    const deltaTime = timestamp - this.start

    this.start = timestamp

    const timeRatio = Math.min(deltaTime / this.duration, 1) // 时间比率，确保在 [0, 1] 范围内
    const deltaX = this.lerp(0, this.deltaX, timeRatio)
    const deltaY = this.lerp(0, this.deltaY, timeRatio)
    const deltaZ = this.lerp(0, this.deltaZ, timeRatio)
    this.duration -= deltaTime
    this.deltaX -= deltaX
    this.deltaY -= deltaY
    this.deltaZ -= deltaZ

    if (this.scene != undefined) {
      this.scene.position.x += deltaX
      this.scene.position.y += deltaY
      this.scene.position.z += deltaZ
    }

    if (this.duration > 0) {
      this.animationId = requestAnimationFrame(this.update)
    } else {
      this.state = false
      this.animationId = null
    }
  }

  /**
   * Stop the move loop, unmount the Vue app and remove the DOM container.
   */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.state = false
    this.app?.unmount()
    this.app = undefined
    document.getElementById(this.id)?.remove()
  }

  /**
   * Get the delta value between start and end.
   * @param start 
   * @param end 
   * @param time 
   * @returns 
   */
  lerp(start: number, end: number, time: number) {
    return start + (end - start) * time
  }
}
