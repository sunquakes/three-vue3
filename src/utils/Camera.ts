import { PerspectiveCamera } from 'three'

/**
 * Far plane for GIS scenes: local metres around a geographic origin still span
 * kilometres, so the compact 1000 m default would clip the map.
 */
export const GIS_CAMERA_FAR = 4000

export interface CameraOptions {
  near?: number
  far?: number
}

export default function (container: HTMLElement, options: CameraOptions = {}): PerspectiveCamera {
  const { near = 0.1, far = 1000 } = options
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  // Guard against a zero-size container (e.g. a scene mounted inside a hidden
  // tab) so the aspect ratio never becomes Infinity/NaN.
  const aspect = containerWidth > 0 && containerHeight > 0 ? containerWidth / containerHeight : 1
  const camera = new PerspectiveCamera(75, aspect, near, far)
  camera.position.set(0, 0, 1)
  camera.lookAt(0, 0, 0)
  return camera
}
