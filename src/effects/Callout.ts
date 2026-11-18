import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { generateUUID } from '../utils/UUID'

export type LineShape = 'straight' | 'broken'
export type BendAxis = 'auto' | 'x' | 'y' | 'z'
export type LabelAnchor = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Maps a LabelAnchor name to the CSS2DObject.center Vector2 used by CSS2DRenderer. */
function labelAnchorToVector2(anchor: LabelAnchor): THREE.Vector2 {
  switch (anchor) {
    case 'top-left':
      return new THREE.Vector2(0, 0)
    case 'top-right':
      return new THREE.Vector2(1, 0)
    case 'bottom-left':
      return new THREE.Vector2(0, 1)
    case 'bottom-right':
      return new THREE.Vector2(1, 1)
    case 'center':
    default:
      return new THREE.Vector2(0.5, 0.5)
  }
}

export interface CalloutOptions {
  /** Line color, default: 0xffffff (white) */
  color?: number | string
  /** Line width (WebGL2 only), default: 1 */
  lineWidth?: number
  /** Line shape: 'straight' for direct line, 'broken' for L-shape with corner, default: 'broken' */
  lineShape?: LineShape
  /** Primary axis for the label-parallel segment of a broken line, default: 'auto' (largest delta) */
  bendAxis?: BendAxis
  /**
   * Ratio (0–1) along `bendAxis` from the label (end) towards the anchor (start)
   * where the bend (corner point) is placed. Lower values bring the corner
   * closer to the label (very obtuse angle), larger values push it towards
   * the anchor (approaching a right angle). Default: 0.45 guarantees an obtuse
   * corner angle when the label and anchor are not perfectly aligned.
   */
  bendRatio?: number
  /**
   * Which corner/point of the label element is anchored at the `end`
   * coordinate. Default: 'bottom-left' — the label's bottom-left corner sits
   * exactly at the `end` position, so the leader line connects to the corner.
   * Ignored when `autoAnchor` is true.
   */
  labelAnchor?: LabelAnchor
  /**
   * When true, the label connection point automatically slides along the
   * label's BOTTOM edge based on the direction from `end` to `start`:
   *   - start directly left  of end → connection at bottom-left  corner
   *   - start directly right of end → connection at bottom-right corner
   *   - start directly above/below  → connection at bottom-center
   *   - intermediate angles interpolate proportionally.
   * Overrides `labelAnchor`. Default: false.
   */
  autoAnchor?: boolean
  /** Use dashed line, default: false */
  dashed?: boolean
  /** Dash size for dashed line, default: 0.1 */
  dashSize?: number
  /** Gap size for dashed line, default: 0.05 */
  gapSize?: number
  /** Show anchor dot at start point, default: true */
  showDot?: boolean
  /** Anchor dot color, default: same as color */
  dotColor?: number | string
  /** Anchor dot radius, default: 0.05 */
  dotRadius?: number
  /** Show label at end point, default: true */
  showLabel?: boolean
}

/**
 * Callout draws a leader line (annotation line) from a 3D anchor point to a
 * label position, with an optional anchor dot and an HTML label at the end
 * point. The whole group is exposed via `scene` and can be added to a THREE.Scene.
 *
 * Supports two line shapes:
 * - 'straight': direct line from anchor to label
 * - 'broken': L-shape (two segments with a corner) — first along `bendAxis`, then to the target
 */
export default class Callout {
  public scene: THREE.Group
  private id: string
  private group: THREE.Group
  private line: THREE.Line
  private lineGeometry: THREE.BufferGeometry
  private lineMaterial: THREE.LineBasicMaterial | THREE.LineDashedMaterial
  private dot: THREE.Mesh | undefined
  private dotGeometry: THREE.SphereGeometry | undefined
  private dotMaterial: THREE.MeshBasicMaterial | undefined
  private label: CSS2DObject | undefined
  private labelElement: HTMLElement | undefined
  private startPoint: THREE.Vector3
  private endPoint: THREE.Vector3
  private cornerPoint: THREE.Vector3
  private lineShape: LineShape
  private bendAxis: BendAxis
  private bendRatio: number
  private labelAnchor: LabelAnchor
  private autoAnchor: boolean

  // Animation state for end point (label position)
  private animStart: number | undefined
  private animDuration: number = 0
  private animDelta = new THREE.Vector3()
  private animFrom = new THREE.Vector3()
  private animating: boolean = false
  private animationId: number | null = null

  // autoAnchor camera tracking
  private camera: THREE.Camera | null = null
  private anchorFrameId: number | null = null

  constructor(
    start: Position,
    end: Position,
    component: HTMLElement | string,
    options: CalloutOptions = {}
  ) {
    const {
      color = 0xffffff,
      lineWidth = 1,
      lineShape = 'broken',
      bendAxis = 'auto',
      bendRatio = 0.45,
      labelAnchor = 'bottom-left',
      autoAnchor = false,
      dashed = false,
      dashSize = 0.1,
      gapSize = 0.05,
      showDot = true,
      dotColor,
      dotRadius = 0.05,
      showLabel = true
    } = options

    this.id = 'callout-' + generateUUID()
    this.startPoint = new THREE.Vector3(...start)
    this.endPoint = new THREE.Vector3(...end)
    this.lineShape = lineShape
    this.bendAxis = bendAxis
    this.bendRatio = Math.max(0, Math.min(1, bendRatio))
    this.labelAnchor = labelAnchor
    this.autoAnchor = autoAnchor
    this.cornerPoint = new THREE.Vector3()
    this.computeCornerPoint()

    this.group = new THREE.Group()

    // Line geometry: 3 points for broken (start→corner→end), 2 points for straight (start→end)
    this.lineGeometry = new THREE.BufferGeometry().setFromPoints(this.buildLinePoints())

    if (dashed) {
      this.lineMaterial = new THREE.LineDashedMaterial({
        color: color,
        linewidth: lineWidth,
        dashSize: dashSize,
        gapSize: gapSize
      })
      this.line = new THREE.Line(this.lineGeometry, this.lineMaterial)
      this.line.computeLineDistances()
    } else {
      this.lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        linewidth: lineWidth
      })
      this.line = new THREE.Line(this.lineGeometry, this.lineMaterial)
    }
    this.group.add(this.line)

    // Anchor dot at start point
    if (showDot) {
      this.dotGeometry = new THREE.SphereGeometry(dotRadius, 16, 16)
      this.dotMaterial = new THREE.MeshBasicMaterial({
        color: dotColor ?? color
      })
      this.dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial)
      this.dot.position.copy(this.startPoint)
      this.group.add(this.dot)
    }

    // Label (CSS2DObject) at end point
    if (showLabel) {
      let containerElement = document.getElementById(this.id)
      if (containerElement == undefined) {
        containerElement = document.createElement('div')
        containerElement.setAttribute('id', this.id)
        document.body.append(containerElement)
      }
      if (typeof component === 'string') {
        containerElement.textContent = component
      } else {
        containerElement.appendChild(component)
      }
      this.labelElement = containerElement
      this.label = new CSS2DObject(containerElement)
      this.label.position.copy(this.endPoint)
      this.applyLabelCenter()
      this.group.add(this.label)
    }

    this.scene = this.group
    this.update = this.update.bind(this)
  }

  /**
   * Attach a camera so the label connection point can follow the camera when
   * `autoAnchor` is enabled. Starts an internal rAF loop that recomputes
   * `label.center` every frame based on the screen-space direction from
   * `end` to `start`. Call `detach()` (or `dispose()`) to stop the loop.
   *
   * No-op when `autoAnchor` is false.
   */
  attach(camera: THREE.Camera) {
    this.camera = camera
    if (!this.autoAnchor || this.anchorFrameId !== null) return
    this.anchorLoop = this.anchorLoop.bind(this)
    this.anchorFrameId = requestAnimationFrame(this.anchorLoop)
  }

  /** Stop the internal autoAnchor rAF loop. Safe to call multiple times. */
  detach() {
    if (this.anchorFrameId !== null) {
      cancelAnimationFrame(this.anchorFrameId)
      this.anchorFrameId = null
    }
    this.camera = null
  }

  /** Internal rAF loop for autoAnchor. */
  private anchorLoop() {
    this.updateLabelAnchor(this.camera ?? undefined)
    this.anchorFrameId = requestAnimationFrame(this.anchorLoop)
  }

  /**
   * Recompute the label connection point (CSS2DObject.center).
   *
   * - When `autoAnchor` is off, applies the static `labelAnchor`.
   * - When `autoAnchor` is on, projects `start` and `end` to SCREEN space
   *   using the supplied camera, then slides `center.x` along the bottom edge
   *   based on the screen-space horizontal direction from end→start:
   *     start left of end on screen  → bottom-left  corner (x=0)
   *     start right of end on screen → bottom-right corner (x=1)
   *     start directly above/below   → bottom-center (x=0.5)
   *   Called automatically every frame by the internal rAF loop started via
   *   `attach(camera)` when `autoAnchor` is true.
   */
  private updateLabelAnchor(camera?: THREE.Camera) {
    if (!this.label) return
    if (!this.autoAnchor) {
      this.label.center.copy(labelAnchorToVector2(this.labelAnchor))
      return
    }
    if (!camera) return

    // OrbitControls updates camera.position/quaternion in its event handler,
    // but matrixWorldInverse is only refreshed by updateMatrixWorld().
    // Sync the camera matrices so the projection reflects the current camera.
    camera.updateMatrixWorld()

    // Project both points to normalized device coordinates (-1..1).
    const s = this.startPoint.clone().project(camera)
    const e = this.endPoint.clone().project(camera)
    const dx = s.x - e.x
    // Use ONLY horizontal screen-space delta (dx) to drive the anchor slide.
    // Vertical differences (dy) are intentionally ignored — even when start is
    // slightly above/below end, if it's clearly on the left or right we want
    // the connection point to reach the bottom-left / bottom-right corner.
    //
    // smoothstep with a small threshold guarantees the connection point FULLY
    // reaches the corners (x=0 or x=1) as soon as |dx| exceeds the threshold,
    // unlike tanh which can never truly saturate to ±1.
    //   start clearly left  (|dx| ≥ threshold) → x = 0 (bottom-left  corner)
    //   start clearly right (|dx| ≥ threshold) → x = 1 (bottom-right corner)
    //   start vertically aligned (dx≈0)         → x = 0.5 (bottom-center)
    const threshold = 0.03 // NDC units (~1.5% of screen width)
    const t = Math.min(1, Math.abs(dx) / threshold)
    const smoothT = t * t * (3 - 2 * t) // smoothstep: 0→1
    const sign = dx >= 0 ? 1 : -1
    const x = 0.5 + 0.5 * sign * smoothT
    this.label.center.set(x, 1)
  }

  /** Backward-compatible private wrapper used by setStart/setEnd/etc. */
  private applyLabelCenter() {
    this.updateLabelAnchor(this.camera ?? undefined)
  }

  private resolveBendAxis(): 'x' | 'y' | 'z' {
    if (this.bendAxis !== 'auto') return this.bendAxis
    const dx = Math.abs(this.endPoint.x - this.startPoint.x)
    const dy = Math.abs(this.endPoint.y - this.startPoint.y)
    const dz = Math.abs(this.endPoint.z - this.startPoint.z)
    if (dx >= dy && dx >= dz) return 'x'
    if (dy >= dz) return 'y'
    return 'z'
  }

  private computeCornerPoint() {
    if (this.lineShape === 'straight') {
      this.cornerPoint.copy(this.endPoint)
      return
    }
    const axis = this.resolveBendAxis()
    const s = this.startPoint
    const e = this.endPoint
    const t = this.bendRatio
    // Obtuse broken line:
    //   - The label-parallel segment runs at the LABEL level (end coords on
    //     non-bend axes) and projects from the label PARTWAY towards the
    //     anchor along the bend axis (controlled by `bendRatio` ∈ [0,1]).
    //   - This guarantees an OBTUSE angle at the corner for any t ∈ (0,1) as
    //     long as the label and anchor have some separation on the non-bend
    //     axes. At t=0 the corner collapses onto the label (180° flat);
    //     at t=1 it's directly opposite the anchor (≈right angle).
    //   - Default t=0.45 yields a comfortably obtuse corner (~120°–135°).
    if (axis === 'x') {
      this.cornerPoint.set(e.x + (s.x - e.x) * t, e.y, e.z)
    } else if (axis === 'y') {
      this.cornerPoint.set(e.x, e.y + (s.y - e.y) * t, e.z)
    } else {
      this.cornerPoint.set(e.x, e.y, e.z + (s.z - e.z) * t)
    }
  }

  private buildLinePoints(): THREE.Vector3[] {
    if (this.lineShape === 'straight') {
      return [this.startPoint.clone(), this.endPoint.clone()]
    }
    return [this.startPoint.clone(), this.cornerPoint.clone(), this.endPoint.clone()]
  }

  /**
   * Animate the label (end point) to a new position.
   * `duration` is in milliseconds.
   */
  moveTo(end: Position, duration: number) {
    const target = new THREE.Vector3(...end)
    this.animFrom.copy(this.endPoint)
    this.animDelta.copy(target).sub(this.endPoint)
    this.animDuration = duration
    this.animStart = undefined

    if (!this.animating) {
      this.animating = true
      this.animationId = requestAnimationFrame(this.update)
    }
  }

  /**
   * Instantly update the anchor (start) point.
   */
  setStart(start: Position) {
    this.startPoint.set(...start)
    this.computeCornerPoint()
    this.refreshLine()
    this.applyLabelCenter()
    if (this.dot) {
      this.dot.position.copy(this.startPoint)
    }
  }

  /**
   * Instantly update the label (end) point.
   */
  setEnd(end: Position) {
    this.endPoint.set(...end)
    this.computeCornerPoint()
    this.refreshLine()
    this.applyLabelCenter()
    if (this.label) {
      this.label.position.copy(this.endPoint)
    }
  }

  /**
   * Switch line shape and/or bend configuration at runtime.
   */
  setLineShape(shape: LineShape, opts?: { bendAxis?: BendAxis; bendRatio?: number }) {
    this.lineShape = shape
    if (opts?.bendAxis !== undefined) this.bendAxis = opts.bendAxis
    if (opts?.bendRatio !== undefined) {
      this.bendRatio = Math.max(0, Math.min(1, opts.bendRatio))
    }
    this.computeCornerPoint()
    // Rebuild geometry since vertex count may change (2 <-> 3)
    this.lineGeometry.dispose()
    this.lineGeometry = new THREE.BufferGeometry().setFromPoints(this.buildLinePoints())
    this.line.geometry = this.lineGeometry
    if (this.lineMaterial instanceof THREE.LineDashedMaterial) {
      this.line.computeLineDistances()
    }
  }

  private update(timestamp: number) {
    if (this.animStart === undefined) {
      this.animStart = timestamp
    }
    const elapsed = timestamp - this.animStart
    const ratio = Math.min(elapsed / this.animDuration, 1)

    this.endPoint.copy(this.animFrom).addScaledVector(this.animDelta, ratio)
    this.computeCornerPoint()
    this.refreshLine()
    this.applyLabelCenter()
    if (this.label) {
      this.label.position.copy(this.endPoint)
    }

    if (ratio < 1) {
      this.animationId = requestAnimationFrame(this.update)
    } else {
      this.animating = false
      this.animationId = null
    }
  }

  /** Recompute line positions and (if dashed) line distances. */
  private refreshLine() {
    const positions = this.lineGeometry.attributes.position as THREE.BufferAttribute
    if (this.lineShape === 'straight') {
      positions.setXYZ(0, this.startPoint.x, this.startPoint.y, this.startPoint.z)
      positions.setXYZ(1, this.endPoint.x, this.endPoint.y, this.endPoint.z)
    } else {
      positions.setXYZ(0, this.startPoint.x, this.startPoint.y, this.startPoint.z)
      positions.setXYZ(1, this.cornerPoint.x, this.cornerPoint.y, this.cornerPoint.z)
      positions.setXYZ(2, this.endPoint.x, this.endPoint.y, this.endPoint.z)
    }
    positions.needsUpdate = true
    if (this.lineMaterial instanceof THREE.LineDashedMaterial) {
      this.line.computeLineDistances()
    }
  }

  /**
   * Dispose callout and release all resources.
   */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.animating = false

    // Stop the autoAnchor rAF loop
    this.detach()

    if (this.labelElement && this.labelElement.parentNode) {
      this.labelElement.parentNode.removeChild(this.labelElement)
    }
    this.labelElement = undefined

    this.lineGeometry.dispose()
    this.lineMaterial.dispose()
    if (this.dotGeometry) {
      this.dotGeometry.dispose()
    }
    if (this.dotMaterial) {
      this.dotMaterial.dispose()
    }

    this.group.clear()
  }
}
