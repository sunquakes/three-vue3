import * as THREE from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

/**
 * The upstream CSS2DRenderer assumes the WebGL projection convention: after
 * applying the viewProjection matrix the NDC Y axis points UP. Its element
 * placement formula is therefore:
 *
 *     translateY = -_vector.y * heightHalf + heightHalf
 *
 * `WebGPURenderer` flips clip-space Y for the same post-projection value, so
 * the upstream formula renders CSS2D labels mirrored vertically. This wrapper
 * rewrites translateY for every CSS2DObject element when the attached renderer
 * reports `coordinateSystem === THREE.WebGPUCoordinateSystem`.
 */
export default function (
  container: HTMLElement,
  mainRenderer?: { coordinateSystem?: number } | null
): CSS2DRenderer {
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  const renderer = new CSS2DRenderer()
  renderer.setSize(containerWidth, containerHeight)
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.pointerEvents = 'none'

  const webgpu = mainRenderer?.coordinateSystem === THREE.WebGPUCoordinateSystem

  if (webgpu) {
    const originalRender = renderer.render.bind(renderer)
    const regex =
      /translate\((-?\d+(?:\.\d+)?%(?:,-?\d+(?:\.\d+)?%)?)\)translate\((-?\d+(?:\.\d+)?)px,(-?\d+(?:\.\d+)?)px\)/

    renderer.render = function (scene: THREE.Scene, camera: THREE.Camera) {
      originalRender(scene, camera)

      // Walk every CSS2DObject and flip its translateY by rewriting the
      // transform string produced by the upstream renderer, so only the one
      // numeric field we care about (the y pixel offset) is touched.
      const stack: THREE.Object3D[] = [scene]
      while (stack.length) {
        const obj = stack.pop()!
        if ((obj as unknown as { isCSS2DObject?: boolean }).isCSS2DObject) {
          const element = (obj as unknown as { element: HTMLElement }).element
          const match = element.style.transform.match(regex)
          if (match) {
            const centerTranslate = match[1]
            const xPx = match[2]
            const yPx = parseFloat(match[3])
            // Mirror the y pixel offset around the viewport center:
            // upstream y = -ndcY*half + half (WebGL), WebGPU maps it to
            // y' = height - y.
            const h = renderer.getSize().height
            const flippedY = h - yPx
            element.style.transform = `translate(${centerTranslate})translate(${xPx}px,${flippedY.toFixed(3)}px)`
          }
        }
        for (let i = 0; i < obj.children.length; i++) {
          stack.push(obj.children[i])
        }
      }
    }
  }

  return renderer
}
