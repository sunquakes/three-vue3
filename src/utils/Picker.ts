import * as THREE from 'three'

export interface PickEvent {
  /** The intersected object */
  object: THREE.Object3D
  /** Intersection point in world space */
  point: THREE.Vector3
  /** Distance from the camera to the intersection point */
  distance: number
  /** The closest intersection that passed the filter */
  intersection: THREE.Intersection
  /** All intersections that passed the filter, sorted by distance */
  intersections: THREE.Intersection[]
  /** Pointer position in normalized device coordinates (-1 to 1) */
  pointer: THREE.Vector2
  /** The originating pointer event, absent for programmatic picks */
  nativeEvent?: PointerEvent
}

export type PickEventType = 'click' | 'hover'

/** Receives the pick result, or `null` when nothing was hit */
export type PickCallback = (event: PickEvent | null) => void

export interface PickerOptions {
  /** Objects to test against, default: the whole scene */
  targets?: THREE.Object3D[]
  /** Traverse descendants of the targets, default: true */
  recursive?: boolean
  /** Keep only the intersections whose object passes this predicate */
  filter?: (object: THREE.Object3D) => boolean
  /** Emit hover events on pointer move, default: true */
  enableHover?: boolean
  /** Max pointer travel in pixels between down and up to still count as a click, default: 5 */
  clickThreshold?: number
  /** Camera layers to pick from, default: all layers */
  layers?: number | number[]
  /** Raycaster near plane */
  near?: number
  /** Raycaster far plane */
  far?: number
}

class Picker {
  private scene: THREE.Scene
  private camera: THREE.Camera
  private domElement: HTMLElement
  private raycaster: THREE.Raycaster
  private pointer: THREE.Vector2
  private targets: THREE.Object3D[] | undefined
  private recursive: boolean
  private filter: ((object: THREE.Object3D) => boolean) | undefined
  private enableHover: boolean
  private clickThreshold: number
  private enabled: boolean = true
  private hovered: THREE.Object3D | null = null
  private pointerDownX: number = 0
  private pointerDownY: number = 0
  private pointerDownValid: boolean = false
  private hoverFrameId: number | null = null
  private pendingMove: PointerEvent | null = null
  private listeners: Record<PickEventType, Set<PickCallback>> = {
    click: new Set(),
    hover: new Set()
  }

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    domElement: HTMLElement,
    options: PickerOptions = {}
  ) {
    const {
      targets,
      recursive = true,
      filter,
      enableHover = true,
      clickThreshold = 5,
      layers,
      near,
      far
    } = options

    this.scene = scene
    this.camera = camera
    this.domElement = domElement
    this.targets = targets
    this.recursive = recursive
    this.filter = filter
    this.enableHover = enableHover
    this.clickThreshold = clickThreshold

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    if (near !== undefined) this.raycaster.near = near
    if (far !== undefined) this.raycaster.far = far

    if (layers !== undefined) {
      this.raycaster.layers.disableAll()
      const list = Array.isArray(layers) ? layers : [layers]
      list.forEach((layer) => this.raycaster.layers.enable(layer))
    }

    this.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.domElement.addEventListener('pointerup', this.onPointerUp)
    this.domElement.addEventListener('pointermove', this.onPointerMove)
    this.domElement.addEventListener('pointerleave', this.onPointerLeave)
  }

  /** Convert a client position to normalized device coordinates */
  private updatePointer(clientX: number, clientY: number) {
    const rect = this.domElement.getBoundingClientRect()
    const width = rect.width || this.domElement.clientWidth || 1
    const height = rect.height || this.domElement.clientHeight || 1

    this.pointer.x = ((clientX - rect.left) / width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / height) * 2 + 1
  }

  /** Run the raycaster and build a pick event out of the closest hit */
  private raycast(nativeEvent?: PointerEvent): PickEvent | null {
    const objects = this.targets ?? this.scene.children

    this.raycaster.setFromCamera(this.pointer, this.camera)

    let intersections = this.raycaster.intersectObjects(objects, this.recursive)

    if (this.filter) {
      const filter = this.filter
      intersections = intersections.filter((item) => filter(item.object))
    }

    const intersection = intersections[0]
    if (!intersection) return null

    return {
      object: intersection.object,
      point: intersection.point,
      distance: intersection.distance,
      intersection,
      intersections,
      pointer: this.pointer.clone(),
      nativeEvent
    }
  }

  private emit(type: PickEventType, event: PickEvent | null) {
    this.listeners[type].forEach((listener) => listener(event))
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled) return

    this.pointerDownX = event.clientX
    this.pointerDownY = event.clientY
    this.pointerDownValid = true
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.enabled || !this.pointerDownValid) return

    this.pointerDownValid = false

    // Dragging the camera around should not be reported as a click
    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    if (Math.sqrt(dx * dx + dy * dy) > this.clickThreshold) return

    if (this.listeners.click.size === 0) return

    this.updatePointer(event.clientX, event.clientY)
    this.emit('click', this.raycast(event))
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled || !this.enableHover) return
    if (this.listeners.hover.size === 0) return

    // Raycasting on every move event is wasteful, coalesce them into one frame
    this.pendingMove = event
    if (this.hoverFrameId !== null) return

    this.hoverFrameId = requestAnimationFrame(this.processMove)
  }

  private processMove = () => {
    this.hoverFrameId = null

    const event = this.pendingMove
    this.pendingMove = null
    if (!event) return

    this.updatePointer(event.clientX, event.clientY)
    const result = this.raycast(event)
    const object = result ? result.object : null

    if (object === this.hovered) return

    this.hovered = object
    this.emit('hover', result)
  }

  private onPointerLeave = () => {
    this.pointerDownValid = false

    if (this.hovered === null) return

    this.hovered = null
    this.emit('hover', null)
  }

  /** Subscribe to a pick event, returns an unsubscribe function */
  on(type: PickEventType, listener: PickCallback) {
    this.listeners[type].add(listener)
    return () => this.off(type, listener)
  }

  /** Unsubscribe from a pick event */
  off(type: PickEventType, listener: PickCallback) {
    this.listeners[type].delete(listener)
  }

  /** Pick at a client position without waiting for a pointer event */
  pickAt(clientX: number, clientY: number) {
    this.updatePointer(clientX, clientY)
    return this.raycast()
  }

  /** Replace the objects to test against, pass undefined to use the whole scene */
  setTargets(targets?: THREE.Object3D[]) {
    this.targets = targets
  }

  /** Replace the intersection filter, pass undefined to accept every object */
  setFilter(filter?: (object: THREE.Object3D) => boolean) {
    this.filter = filter
  }

  /** Enable or disable the picker without detaching it */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.onPointerLeave()
  }

  /** The object currently under the pointer */
  getHovered() {
    return this.hovered
  }

  /** Detach listeners and release references */
  dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.domElement.removeEventListener('pointerleave', this.onPointerLeave)

    if (this.hoverFrameId !== null) {
      cancelAnimationFrame(this.hoverFrameId)
      this.hoverFrameId = null
    }

    this.pendingMove = null
    this.hovered = null
    this.listeners.click.clear()
    this.listeners.hover.clear()
  }
}

export default Picker
