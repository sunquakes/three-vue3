import { defineComponent, inject } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

export default defineComponent({
  setup(props) {
    const sceneSlotProps: SceneSlotProps | undefined = inject('sceneSlotProps')
    return {
      async init() {
        const renderer = sceneSlotProps?.renderer
        const scene = sceneSlotProps?.scene
        const sceneComponents = sceneSlotProps?.sceneComponents
        const container = sceneSlotProps?.container
        const camera = sceneComponents?.camera
        const light = sceneComponents?.light

        light.layers.enable(props.layer)
        camera.layers.enable(props.layer)

        const composer = new EffectComposer(renderer)

        const renderPass = new RenderPass(scene, camera)
        composer.addPass(renderPass)

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(container?.clientWidth, container?.clientHeight),
          props.strength,
          props.radius,
          props.threshold
        )
        composer.addPass(bloomPass)

        if (props.layer === 0) {
          sceneSlotProps?.setFrame?.(
            (renderer: THREE.WebGLRenderer, scene: THREE.Scene, components: SceneComponents) => {
              renderer.clear()
              components.camera.layers.set(props.layer)
              composer?.render()
            }
          )
        } else {
          sceneSlotProps?.addBeforeFrame?.(
            (renderer: THREE.WebGLRenderer, scene: THREE.Scene, components: SceneComponents) => {
              renderer.clear()
              components.camera.layers.set(props.layer)
              composer?.render()
            }
          )
        }
      }
    }
  },
  render() {
    return this.$slots.default?.()
  },
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
  mounted() {
    this.init()
  }
})
