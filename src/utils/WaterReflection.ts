import * as THREE from 'three'

const mirrorPlane = new THREE.Plane()
const mirrorNormal = new THREE.Vector3()
const mirrorWorldPosition = new THREE.Vector3()
const cameraWorldPosition = new THREE.Vector3()
const cameraRotation = new THREE.Matrix4()
const lookAtPosition = new THREE.Vector3()
const clipPlane = new THREE.Vector4()
const mirrorView = new THREE.Vector3()
const mirrorTarget = new THREE.Vector3()
const clipPlaneCorner = new THREE.Vector4()

/**
 * Builds the mirrored camera used for the WebGL planar reflection capture.
 * Port of the classic Reflector mirror math with an oblique near plane so
 * geometry below the water plane does not leak into the reflection.
 *
 * The reflected camera keeps the original up vector reflected as well, which
 * mirrors its horizontal axis. The reflection texture is therefore sampled
 * with `screenUV.flipX()`, matching the WebGPU reflector node.
 *
 * Returns false when the water plane faces away from the camera, in which
 * case the previous capture should be kept.
 */
export function updateMirrorCamera(
  camera: THREE.PerspectiveCamera,
  mirror: THREE.Mesh,
  mirrorCamera: THREE.PerspectiveCamera
): boolean {
  mirrorWorldPosition.setFromMatrixPosition(mirror.matrixWorld)
  cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld)
  cameraRotation.extractRotation(mirror.matrixWorld)
  mirrorNormal.set(0, 0, 1).applyMatrix4(cameraRotation)

  mirrorView.subVectors(mirrorWorldPosition, cameraWorldPosition)
  if (mirrorView.dot(mirrorNormal) > 0) {
    return false
  }

  mirrorView.reflect(mirrorNormal).negate()
  mirrorView.add(mirrorWorldPosition)

  cameraRotation.extractRotation(camera.matrixWorld)
  lookAtPosition.set(0, 0, -1).applyMatrix4(cameraRotation).add(cameraWorldPosition)
  mirrorTarget
    .subVectors(mirrorWorldPosition, lookAtPosition)
    .reflect(mirrorNormal)
    .negate()
    .add(mirrorWorldPosition)

  mirrorCamera.position.copy(mirrorView)
  mirrorCamera.up.set(0, 1, 0).applyMatrix4(cameraRotation).reflect(mirrorNormal)
  mirrorCamera.lookAt(mirrorTarget)
  mirrorCamera.far = camera.far
  mirrorCamera.updateMatrixWorld()
  mirrorCamera.projectionMatrix.copy(camera.projectionMatrix)

  // Oblique near plane: http://www.terathon.com/code/oblique.html
  mirrorPlane.setFromNormalAndCoplanarPoint(mirrorNormal, mirrorWorldPosition)
  mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse)
  clipPlane.set(
    mirrorPlane.normal.x,
    mirrorPlane.normal.y,
    mirrorPlane.normal.z,
    mirrorPlane.constant
  )

  const projectionMatrix = mirrorCamera.projectionMatrix
  const elements = projectionMatrix.elements
  clipPlaneCorner.x = (Math.sign(clipPlane.x) + elements[8]) / elements[0]
  clipPlaneCorner.y = (Math.sign(clipPlane.y) + elements[9]) / elements[5]
  clipPlaneCorner.z = -1
  clipPlaneCorner.w = (1 + elements[10]) / elements[14]
  clipPlane.multiplyScalar(1 / clipPlane.dot(clipPlaneCorner))

  elements[2] = clipPlane.x
  elements[6] = clipPlane.y
  elements[10] = clipPlane.z + 1
  elements[14] = clipPlane.w
  mirrorCamera.projectionMatrixInverse.copy(projectionMatrix).invert()

  return true
}
