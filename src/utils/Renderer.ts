import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js'

export type RendererType = 'webgpu' | 'webgl'

/**
 * Creates a renderer instance of the requested type. Defaults to `webgpu`.
 *
 * - `webgpu`: `WebGPURenderer` from `three/webgpu`. It automatically falls back
 *   to the WebGL2 backend when WebGPU is not available, and all TSL shaders in
 *   this library compile to WGSL on WebGPU and GLSL on the WebGL backend.
 * - `webgl`: the classic `THREE.WebGLRenderer`. The library is built entirely
 *   on three.js TSL (NodeMaterial); a plain `WebGLRenderer` cannot compile TSL
 *   shaders because it has no node builder, so we attach three's official
 *   `WebGLNodesHandler`, which bridges the node system into `WebGLRenderer`
 *   (TSL compiles to GLSL and runs on a genuine WebGL context).
 *
 * The returned renderer is NOT yet initialized. `WebGPURenderer` needs
 * `await renderer.init()` before rendering; `<tv-scene>` awaits it
 * automatically.
 */
export default function (type: RendererType = 'webgpu'): R3LRenderer {
  if (type === 'webgl') {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    // WebGLNodesHandler compiles TSL node materials to GLSL for WebGLRenderer.
    // WebGLRenderer.render() invokes renderStart/renderEnd/build automatically
    // once the handler is attached via setNodesHandler().
    const nodesHandler = new WebGLNodesHandler()
    nodesHandler.setRenderer(renderer)
    renderer.setNodesHandler(nodesHandler)
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1.0
    return renderer as unknown as R3LRenderer
  }

  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true
  })
  renderer.toneMapping = THREE.NoToneMapping
  renderer.toneMappingExposure = 1.0
  return renderer as unknown as R3LRenderer
}
