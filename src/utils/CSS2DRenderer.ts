import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export default function (container: HTMLElement): CSS2DRenderer {
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  let renderer = new CSS2DRenderer()
  renderer.setSize(containerWidth, containerHeight)
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.pointerEvents = 'none'
  return renderer
}
