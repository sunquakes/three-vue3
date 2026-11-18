import { defineComponent, onBeforeUnmount, onMounted, watch } from 'vue'
import * as THREE from 'three'
import { RenderPipeline } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom as tslBloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { useScene } from '../context/SceneContext'

/**
 * Post-processing bloom effect.
 *
 * Uses two code paths depending on the active renderer:
 * - **WebGPURenderer**: `RenderPipeline` + TSL `bloom()` node (the modern
 *   node-based post-processing pipeline from `three/webgpu`).
 * - **WebGLRenderer**: `EffectComposer` + `UnrealBloomPass` from three's
 *   examples (the classic pass-based approach).
 *
 * For `layer === 0` the bloom replaces the main frame callback entirely.
 * For `layer > 0` bloom is rendered in `beforeFrame` (only objects in that
 * layer), then the main scene renders on top.
 */
export default defineComponent({
  name: 'TvBloom',
  props: {
    layer: {
      type: Number,
      default: 0
    },
    strength: {
      type: Number,
      default: 1
    },
    radius: {
      type: Number,
      default: 0.5
    },
    threshold: {
      type: Number,
      default: 0.5
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let bloomComposer: EffectComposer | null = null
    let postProcessing: RenderPipeline | null = null
    let removeBeforeFrame: (() => void) | undefined
    let resizeObserver: ResizeObserver | undefined
    let created = false

    function destroy() {
      removeBeforeFrame?.()
      removeBeforeFrame = undefined
      resizeObserver?.disconnect()
      resizeObserver = undefined
      bloomComposer?.dispose()
      bloomComposer = null
      postProcessing?.dispose()
      postProcessing = null
      const { camera, light } = sceneContext.sceneComponents ?? {}
      if (created) {
        const layer = props.layer
        light?.layers.disable(layer)
        camera?.layers.disable(layer)
        created = false
      }
      if (props.layer === 0) {
        sceneContext.resetFrame?.()
      }
    }

    function create() {
      destroy()

      const { renderer, scene, sceneComponents, container, setFrame, addBeforeFrame } = sceneContext

      if (!renderer || !scene || !sceneComponents?.camera || !sceneComponents?.light || !container) {
        return
      }

      const { camera, light } = sceneComponents
      const { layer, strength, radius, threshold } = props

      light.layers.enable(layer)
      camera.layers.enable(layer)
      created = true

      const width = container.clientWidth
      const height = container.clientHeight

      const isWebGPU = renderer.isWebGPURenderer === true

      if (isWebGPU) {
        // --- WebGPU path: RenderPipeline + TSL BloomNode ---
        // The RenderPipeline must fully replace the main frame via setFrame.
        // On WebGPU every render() call performs a full-screen output pass, so
        // layering a beforeFrame render under the main render would be
        // overwritten instead of composited.

        const scenePass = pass(scene, camera)
        const scenePassColor = scenePass.getTextureNode('output')

        let bloomPass
        if (layer === 0) {
          // Full-scene bloom: apply bloom to the entire scene.
          bloomPass = tslBloom(scenePassColor, strength, radius, threshold)
        } else {
          // Selective bloom: render the bloom layer into a separate pass,
          // apply bloom to it, then composite it over the full scene pass.
          const bloomLayerPass = pass(scene, camera)
          const bloomLayers = new THREE.Layers()
          bloomLayers.set(layer)
          bloomLayerPass.setLayers(bloomLayers)
          const bloomLayerColor = bloomLayerPass.getTextureNode('output')
          bloomPass = tslBloom(bloomLayerColor, strength, radius, threshold)
        }

        postProcessing = new RenderPipeline(renderer)
        postProcessing.outputNode = scenePassColor.add(bloomPass)

        setFrame?.(() => {
          postProcessing?.render()
        })
      } else {
        // --- WebGL path: EffectComposer + UnrealBloomPass ---

        bloomComposer = new EffectComposer(renderer as unknown as THREE.WebGLRenderer)
        bloomComposer.addPass(new RenderPass(scene, camera))
        bloomComposer.addPass(
          new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold)
        )

        // Keep the composer size in sync with the container. When the scene is
        // first mounted inside a not-yet-laid-out (or hidden) container the
        // clientWidth/clientHeight above can be 0, which makes UnrealBloomPass
        // render into 0x0 targets and silently disables the effect until the
        // page is reloaded. Scene already resizes its canvas through its own
        // ResizeObserver, so the composer must follow the same resizes.
        resizeObserver = new ResizeObserver(() => {
          const w = container.clientWidth
          const h = container.clientHeight
          if (w > 0 && h > 0) {
            bloomComposer?.setSize(w, h)
          }
        })
        resizeObserver.observe(container)

        if (layer === 0) {
          // layer 0: Apply bloom to all objects
          setFrame?.(() => {
            renderer.clear()
            camera.layers.set(layer)
            bloomComposer?.render()
          })
        } else {
          // layer > 0: Apply bloom only to objects in that layer
          removeBeforeFrame = addBeforeFrame?.(() => {
            renderer.clear()
            camera.layers.set(layer)
            bloomComposer?.render()
            renderer.clearDepth()
          })
        }
      }
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    watch(() => [props.layer, props.strength, props.radius, props.threshold], create)
  },
  render() {
    return this.$slots.default ? this.$slots.default() : null
  }
})
