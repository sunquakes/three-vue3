import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { fitCameraToBox, fitCameraToObject, fitCameraToPoints } from './CameraFit'
import type { CameraFitOptions, FitPoint } from './CameraFit'

export interface FitCameraOptions extends CameraFitOptions {}

/**
 * A perspective camera with scene-framing helpers. It is a drop-in
 * `THREE.PerspectiveCamera` (same constructor parameters, a plain native
 * `position`, and the Scene's resize/controls code keeps working unchanged).
 *
 * Bind the scene's `OrbitControls` with {@link FitCamera.bind} so the `fitTo*`
 * framing helpers run without re-threading the controls into every call.
 */
export class FitCamera extends THREE.PerspectiveCamera {
  /** Controls whose target is synced by the framing helpers. */
  controls: OrbitControls | null = null

  constructor(fov = 75, aspect = 1, near = 0.1, far = 1000) {
    super(fov, aspect, near, far)
    this.position.set(0, 0, 1)
  }

  /**
   * Bind (or rebind) the controls used by later framing calls. Pass `null`
   * explicitly to clear the binding.
   */
  bind(controls?: OrbitControls | null): this {
    if (controls !== undefined) this.controls = controls
    return this
  }

  /** Frame a set of local metre points (`THREE.Vector3` / `{x, y, z}`). */
  fitToPoints(points: FitPoint[], options: FitCameraOptions = {}): this {
    const { controls, ...fitOptions } = options
    fitCameraToPoints(this, points, {
      ...fitOptions,
      controls: controls ?? this.controls
    })
    return this
  }

  /** Frame the world-space bounding box of one or more objects. */
  fitToObject(object: THREE.Object3D | THREE.Object3D[], options: CameraFitOptions = {}): this {
    fitCameraToObject(this, object, {
      ...options,
      controls: options.controls ?? this.controls
    })
    return this
  }

  /** Frame an explicit axis-aligned box already expressed in local metres. */
  fitToBox(box: THREE.Box3, options: CameraFitOptions = {}): this {
    fitCameraToBox(this, box, {
      ...options,
      controls: options.controls ?? this.controls
    })
    return this
  }
}

export default FitCamera
