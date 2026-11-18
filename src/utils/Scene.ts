import * as THREE from 'three'
import { PMREMGenerator as NodePMREMGenerator } from 'three/webgpu'
// The legacy WebGL PMREMGenerator must come from the 'three' build: the
// node-based three/webgpu one requires renderer.hasInitialized(), which only
// WebGPURenderer provides, so it cannot be used with a classic WebGLRenderer.
import { PMREMGenerator as LegacyPMREMGenerator } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import CSS2DRenderer from './CSS2DRenderer'
import { bindSceneGeo } from '../crs/SceneGeo'

export interface SceneRuntime {
  scene: THREE.Scene
  dispose: () => void
}

export default async function (
  renderer: R3LRenderer,
  container: HTMLElement,
  components: SceneComponents,
  frame: CallbackFrame,
  beforeFrame?: CallbackFrame,
  afterFrame?: CallbackFrame
): Promise<SceneRuntime> {
  const camera = components.camera
  const scene = new THREE.Scene()

  // Attach the renderer to the scene so custom meshes can read
  // isWebGPURenderer at runtime to adapt to rendering differences such as
  // color output.
  scene.userData.renderer = renderer

  // Always install scene.setPosition so cameras and objects can be placed
  // without threading the reference around. With no GeoReference the helper
  // still works, treating lng/lat/alt (and x/y/z) as plain local metres.
  bindSceneGeo(scene, components.geo)

  scene.add(components.light)

  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight

  renderer.setSize(containerWidth, containerHeight)
  // WebGPURenderer requires an explicit init() before rendering.
  // WebGLRenderer does not have init; guard it to stay compatible with any
  // user-supplied WebGL renderer.
  if (typeof (renderer as unknown as { init?: () => Promise<unknown> }).init === 'function') {
    await (renderer as unknown as { init: () => Promise<unknown> }).init()
  }
  // Ensure consistent clear behavior across WebGL and WebGPU.
  // With alpha:true the default clear alpha is 0 (transparent).
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement as HTMLElement)

  // Pass the main renderer through so CSS2DRenderer can detect the backend
  // coordinate system and correct the label translateY for WebGPU.
  const css2DRenderer = CSS2DRenderer(container, renderer)
  container.appendChild(css2DRenderer.domElement)
  renderer.autoClear = false

  // --- Default PBR environment ---------------------------------------------
  // PBR materials (MeshStandard / MeshPhysical, as produced by GLTF/FBX
  // loaders) rely on a scene-level environment to resolve their IBL reflection
  // term. Without an envMap, reflective/metallic surfaces appear black.
  let defaultEnvTarget: { texture: THREE.Texture; dispose: () => void } | null = null
  try {
    const envScene = new THREE.Scene()
    envScene.background = new THREE.Color(0xcccccc)
    // Keep the default IBL environment modest. A strong value here becomes a
    // fixed, un-animatable base light that drowns out runtime light changes
    // (e.g. LightGradient) and blows out PBR surfaces.
    const hemi = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 2.0)
    envScene.add(hemi)

    const isNodeRenderer = (renderer as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer

    if (isNodeRenderer) {
      const pmrem = new NodePMREMGenerator(
        renderer as unknown as ConstructorParameters<typeof NodePMREMGenerator>[0]
      )
      const target = pmrem.fromScene(envScene, 0.04)
      defaultEnvTarget = target
      scene.environment = target.texture
      pmrem.dispose()
    } else {
      const pmrem = new LegacyPMREMGenerator(
        renderer as unknown as ConstructorParameters<typeof LegacyPMREMGenerator>[0]
      )
      pmrem.compileEquirectangularShader()
      const target = pmrem.fromScene(envScene, 0.04)
      defaultEnvTarget = target
      scene.environment = target.texture
      pmrem.dispose()
    }

    envScene.remove(hemi)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[three-vue3] PMREMGenerator not available; default PBR environment skipped. ' + msg)
  }

  let frameId = 0
  let lastTime = performance.now()
  let disposed = false

  function animate() {
    if (disposed) return
    frameId = requestAnimationFrame(animate)

    const now = performance.now()
    // Clamp the delta so a background tab resuming after a long pause does not
    // teleport every effect forward.
    const delta = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    beforeFrame?.(renderer, scene, components, delta)
    if (components.controls instanceof OrbitControls) {
      components.controls.update()
    }
    frame(renderer, scene, components, delta)
    css2DRenderer.render(scene, camera)
    afterFrame?.(renderer, scene, components, delta)
  }
  animate()

  if (components.axesHelper instanceof THREE.AxesHelper) {
    scene.add(components.axesHelper)
  }

  if (components.gridHelper instanceof THREE.GridHelper) {
    scene.add(components.gridHelper)
  }

  function updateSize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    renderer.setSize(width, height)
    css2DRenderer.setSize(width, height)

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
  }

  // A ResizeObserver catches container-driven layout changes (sidebars,
  // panels, full-screen toggles) that a window resize never fires for.
  const resizeObserver = new ResizeObserver(() => updateSize())
  resizeObserver.observe(container)
  window.addEventListener('resize', updateSize)
  // The first ResizeObserver callback is async; callers that frame content in
  // `created` need the real aspect immediately.
  updateSize()

  function dispose() {
    if (disposed) return
    disposed = true

    cancelAnimationFrame(frameId)
    resizeObserver.disconnect()
    window.removeEventListener('resize', updateSize)

    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement as HTMLElement)
    }
    if (css2DRenderer.domElement.parentNode) {
      css2DRenderer.domElement.parentNode.removeChild(css2DRenderer.domElement)
    }

    // Drop the default environment so the render target can be released.
    if (scene.environment === (defaultEnvTarget?.texture ?? null)) {
      scene.environment = null
    }
    defaultEnvTarget?.dispose()
    defaultEnvTarget = null

    // Scene contents are owned by the caller (loaders, effects, demos), so they
    // are not traversed and disposed here.
    scene.clear()
  }

  return { scene, dispose }
}
