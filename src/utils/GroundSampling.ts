import * as THREE from 'three'

/**
 * Ground coverage is capped to this multiple of the camera's height above the
 * ground. At grazing angles frustum corner rays meet the ground dozens of
 * kilometres away (or never), so without a cap the tile selection would fan
 * out towards the horizon instead of staying around the viewer. The cap is
 * also where distance fog reaches full opacity, so the rectangular tile edge
 * dissolves into the background without a seam.
 */
export const MAX_GROUND_RANGE_FACTOR = 6

/**
 * Sample the ground the camera can actually see, the way mature engines
 * (Cesium/MapLibre) derive their tile cover: cast rays through the four
 * frustum corners plus the view centre onto the ground plane and return the
 * hit points; the caller takes their bounding box.
 *
 * - A ray that meets the ground beyond the range cap is clamped along its
 *   bearing to the cap (the far plane would clip anything farther, and every
 *   chosen quad would go dark).
 * - A ray at/above the horizon cannot see ground along that edge. It
 *   collapses to the ground point straight below the camera - the nearest
 *   ground the frame still contains - never to the range cap: pushing a
 *   skyward corner to the cap tears the coverage rectangle far past the
 *   on-screen ground, which leaves the near field un-tiled and shows the map
 *   only as a small patch while most of the frame stays empty.
 * - The view-centre ray is included as a floor: whatever the corners do, the
 *   point the camera looks at is always covered.
 */
export function sampleVisibleGround(
  camera: THREE.PerspectiveCamera,
  groundY: number,
  maxRangeFactor = MAX_GROUND_RANGE_FACTOR
): THREE.Vector3[] {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY)
  const raycaster = new THREE.Raycaster()
  const probes: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [0, 0]
  ]

  const height = Math.max(camera.position.y - groundY, 1e-6)
  const horizonRange = height * maxRangeFactor
  // Largest horizontal distance at which the frustum can still reach the
  // ground: the far sphere meets the ground plane sqrt(far^2 - h^2) away.
  const farRange = camera.far > height ? Math.sqrt(camera.far * camera.far - height * height) : 0
  const maxRange = farRange > 0 ? Math.min(horizonRange, farRange) : horizonRange

  const groundBelowCamera = new THREE.Vector3(camera.position.x, groundY, camera.position.z)

  return probes.map(([ndcX, ndcY]) => {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) {
      // Skyward ray: collapse to the ground under the camera.
      return groundBelowCamera.clone()
    }
    const dx = hit.x - camera.position.x
    const dz = hit.z - camera.position.z
    const horizontalDistance = Math.hypot(dx, dz)
    if (horizontalDistance <= maxRange) return hit
    // Far/grazing hit: clamp to the range cap along the same ground bearing.
    const scale = maxRange / horizontalDistance
    return new THREE.Vector3(
      camera.position.x + dx * scale,
      groundY,
      camera.position.z + dz * scale
    )
  })
}
