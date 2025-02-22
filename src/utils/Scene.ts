import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import CSS2DRenderer from './CSS2DRenderer'

export default function (
  renderer: THREE.WebGLRenderer,
  container: HTMLElement,
  components: SceneComponents,
  frame: CallbackFrame,
  beforeFrame?: CallbackFrame,
  afterFrame?: CallbackFrame
): THREE.Scene {
  const camera = components.camera
  const scene = new THREE.Scene()
  scene.add(components.light)

  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight

  renderer.setSize(containerWidth, containerHeight)
  container.appendChild(renderer.domElement)

  const css2DRenderer = CSS2DRenderer(container)
  container.appendChild(css2DRenderer.domElement)
  renderer.autoClear = false

  function animate() {
    beforeFrame?.(renderer, scene, components)
    if (components.controls instanceof OrbitControls) {
      components.controls.update()
    }
    frame(renderer, scene, components)
    css2DRenderer.render(scene, camera)
    afterFrame?.(renderer, scene, components)
    requestAnimationFrame(animate)
  }
  animate()

  if (components.axesHelper instanceof THREE.AxesHelper) {
    scene.add(components.axesHelper)
  }

  function onWindowResize() {
    renderer.setSize(containerWidth, containerHeight)
    css2DRenderer.setSize(containerWidth, containerHeight)
  }

  window.addEventListener('resize', onWindowResize)
  return scene
}
