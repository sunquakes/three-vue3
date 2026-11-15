import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface CameraFitOptions {
  /**
   * Viewing elevation above the horizontal plane in radians. 0 is a horizontal
   * view, PI/2 is top-down. Defaults to ~45deg, which keeps a ground plane from
   * occluding the markers.
   */
  elevation?: number
  /**
   * Horizontal bearing of the camera around the target in radians, measured
   * clockwise from north (-Z) like a GIS compass bearing. Defaults to PI/4.
   */
  azimuth?: number
  /** Multiplier applied to the computed distance; >1 zooms out for margin. */
  padding?: number
  /** Override the computed distance (in local metres). */
  distance?: number
  /** When true (default), derive near/far planes from the content scale. */
  adjustClip?: boolean
  /** OrbitControls target is synced to the box centre when supplied. */
  controls?: OrbitControls | null
}

/**
 * A position already expressed in the local three.js metre frame. Both
 * THREE.Vector3 and a plain {x, y, z} object are accepted.
 */
export type LocalPoint = THREE.Vector3 | { x: number; y: number; z?: number }

/** Local point accepted by the unified framing entry point. */
export type FitPoint = LocalPoint

const DEFAULT_ELEVATION = Math.PI / 4
const DEFAULT_AZIMUTH = Math.PI / 4
const DEFAULT_PADDING = 1.4

/**
 * Frame a perspective camera on an axis-aligned box expressed in the same local
 * metre space three.js renders in. Distance, position and (optionally) the near
 * and far clipping planes are derived from the box, so callers never hard-code
 * a far plane or a viewpoint that belongs to a specific data scale.
 */
export function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  options: CameraFitOptions = {}
): THREE.PerspectiveCamera {
  const {
    elevation = DEFAULT_ELEVATION,
    azimuth = DEFAULT_AZIMUTH,
    padding = DEFAULT_PADDING,
    distance: distanceOverride,
    adjustClip = true,
    controls = null
  } = options

  if (box.isEmpty()) return camera

  const center = box.getCenter(new THREE.Vector3())

  const fitDistance =
    distanceOverride ?? computeFitDistance(camera, box, center, elevation, azimuth) * padding

  placeCamera(camera, center, fitDistance, elevation, azimuth)

  if (adjustClip) {
    // Keep the near/far ratio bounded so depth precision is not wasted. The far
    // plane only has to cover the view distance plus the content radius, not a
    // fixed large number, so city-scale and particle-scale scenes both fit.
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius
    camera.near = THREE.MathUtils.clamp(fitDistance / 1000, 0.05, 10)
    camera.far = (fitDistance + radius) * 4
    camera.updateProjectionMatrix()
  }

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }

  // lookAt only updates the orientation quaternion; sync the world matrix so a
  // caller projecting points right after fitting reads the new transform.
  camera.updateMatrixWorld()

  return camera
}

/**
 * Frame a camera on the world-space bounding box of one or more objects.
 */
export function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D | THREE.Object3D[],
  options: CameraFitOptions = {}
): THREE.PerspectiveCamera {
  const box = new THREE.Box3()
  const objects = Array.isArray(object) ? object : [object]
  for (const item of objects) box.expandByObject(item)
  return fitCameraToBox(camera, box, options)
}

/**
 * Unified framing entry point for local metre positions (`THREE.Vector3` /
 * `{x, y, z}`). Every point is expanded into one box, which is then framed with
 * the same routine as {@link fitCameraToBox}.
 */
export function fitCameraToPoints(
  camera: THREE.PerspectiveCamera,
  points: FitPoint[],
  options: CameraFitOptions = {}
): THREE.PerspectiveCamera {
  if (points.length === 0) return camera

  const box = new THREE.Box3()
  const local = new THREE.Vector3()

  for (const point of points) {
    local.set(point.x, point.y, (point as { z?: number }).z ?? 0)
    box.expandByPoint(local)
  }

  return fitCameraToBox(camera, box, options)
}

/**
 * Build the camera basis for a spherical viewpoint. `camDir` points from the
 * target toward the camera (its Y component is +sin(elevation), so the camera
 * is always above the ground), `forward = -camDir` points from the camera
 * toward the target, and the camera itself sits at target + camDir*distance.
 * Azimuth is measured clockwise around +Y from north (-Z), the conventional
 * GIS bearing, and elevation is the angle above the ground plane. Both the fit
 * distance and the placement derive from this same basis so they can never
 * disagree.
 */
function cameraBasis(
  elevation: number,
  azimuth: number
): {
  camDir: THREE.Vector3
  forward: THREE.Vector3
  right: THREE.Vector3
  up: THREE.Vector3
} {
  const cosE = Math.cos(elevation)
  const camDir = new THREE.Vector3(
    cosE * Math.sin(azimuth),
    Math.sin(elevation),
    -cosE * Math.cos(azimuth)
  ).normalize()
  const forward = camDir.clone().negate()
  const worldUp = new THREE.Vector3(0, 1, 0)
  // At elevation PI/2 camDir is parallel to worldUp and the cross product
  // degenerates; keep the azimuth meaningful as an image roll instead.
  const right =
    cosE > 1e-6
      ? new THREE.Vector3().crossVectors(forward, worldUp).normalize()
      : new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
  const up = new THREE.Vector3().crossVectors(right, forward).normalize()
  return { camDir, forward, right, up }
}

/**
 * Distance needed to keep every box corner inside the frustum. Each corner is
 * expressed in the camera basis; its projected half-size must fit the horizontal
 * and vertical field of view at the corner's own depth, which also accounts for
 * corners that sit nearer to the camera than the target plane.
 */
function computeFitDistance(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  center: THREE.Vector3,
  elevation: number,
  azimuth: number
): number {
  const vFov = THREE.MathUtils.degToRad(camera.fov)
  const aspect = camera.aspect > 0 ? camera.aspect : 1
  const tanV = Math.tan(vFov / 2)
  const tanH = Math.tan(vFov / 2) * aspect

  const { camDir, right, up } = cameraBasis(elevation, azimuth)
  const corner = new THREE.Vector3()
  let distance = 0

  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        corner.set(
          ix ? box.max.x : box.min.x,
          iy ? box.max.y : box.min.y,
          iz ? box.max.z : box.min.z
        )
        corner.sub(center)
        // Depth of the corner along the target -> camera axis. A corner nearer
        // the camera contributes a smaller required distance, a farther corner
        // a larger one, so the maximum over all corners always encloses the box.
        const depth = corner.dot(camDir)
        const sx = Math.abs(corner.dot(right))
        const sy = Math.abs(corner.dot(up))
        distance = Math.max(distance, depth + sx / tanH, depth + sy / tanV)
      }
    }
  }

  return distance
}

function placeCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  distance: number,
  elevation: number,
  azimuth: number
): void {
  const { camDir } = cameraBasis(elevation, azimuth)
  camera.position.copy(target).addScaledVector(camDir, distance)
  camera.lookAt(target)
}
