import { defineComponent, h, PropType, ref, nextTick, provide, reactive } from 'vue'
import { generateUUID } from '../utils/UUID'
import Scene from '../utils/Scene'
import Camera from '../utils/Camera'
import Light from '../utils/Light'
import Renderer from '../utils/Renderer'
import AxesHelper from '../utils/AxesHelper'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default defineComponent({
  emits: [
    'update:modelValue',
    'update:renderer',
    'update:camera',
    'update:light',
    'update:axesHelper',
    'update:controls',
    'created',
    'beforeFrame',
    'frame',
    'afterFrame'
  ],
  setup(props, { emit }) {
    let UUID = ref()
    const showSlot = ref(false)

    const beforeFrameChildren = reactive<Array<CallbackFrame>>([])
    const afterFrameChildren = reactive<Array<CallbackFrame>>([])

    const sceneSlotProps: SceneSlotProps = {}
    provide('sceneSlotProps', sceneSlotProps)

    let callbackFrame: CallbackFrame = (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      components: SceneComponents
    ) => {
      const camera = components.camera
      renderer.clearDepth()
      camera.layers.set(0)
      renderer.render(scene, camera)
    }

    function frame(renderer: THREE.WebGLRenderer, scene: THREE.Scene, components: SceneComponents) {
      callbackFrame(renderer, scene, components)
    }
    function beforeFrame(
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      components: SceneComponents
    ) {
      emit('beforeFrame', renderer, scene, components)
      beforeFrameChildren?.forEach((beforeFrameChild) => {
        beforeFrameChild?.(renderer, scene, components)
      })
    }
    function afterFrame(
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      components: SceneComponents
    ) {
      emit('afterFrame', renderer, scene, components)
      afterFrameChildren?.forEach((afterFrameChild) => {
        afterFrameChild?.(renderer, scene, components)
      })
    }

    return {
      UUID,
      showSlot,
      async init() {
        UUID.value = generateUUID()
        await nextTick()

        const element = document.getElementById(UUID.value)
        const container = element || undefined
        if (!container) {
          console.error(`Container with id "${UUID.value}" not found`)
          return
        }
        let renderer = props.renderer
        if (renderer == undefined) {
          renderer = Renderer()
          emit('update:renderer', renderer)
        }
        let camera = props.camera
        if (camera == undefined) {
          camera = Camera(container)
          emit('update:camera', camera)
        }
        let light = props.light
        if (light == undefined) {
          light = Light()
          emit('update:light', light)
        }
        let axesHelper = props.axesHelper
        if (axesHelper === undefined) {
          axesHelper = AxesHelper()
          emit('update:axesHelper', axesHelper)
        }
        let controls = props.controls
        if (controls === undefined) {
          controls = new OrbitControls(camera, container)
          emit('update:controls', controls)
        }
        const sceneComponents: SceneComponents = {
          camera: camera,
          light: light,
          axesHelper: axesHelper,
          controls: controls
        }
        const scene = Scene(renderer, container, sceneComponents, frame, beforeFrame, afterFrame)
        if (props.bgImage != undefined) {
          const textureLoader = new THREE.TextureLoader()
          const texture = textureLoader.load(props.bgImage)
          scene.background = texture
        } else if (props.bgColor != undefined) {
          scene.background = new THREE.Color(props.bgColor)
        }
        emit('update:modelValue', scene)
        emit('created', scene, sceneComponents)

        Object.assign(sceneSlotProps, {
          container: container,
          renderer: renderer,
          scene: scene,
          sceneComponents: sceneComponents,
          setFrame: (callback: CallbackFrame) => {
            callbackFrame = callback
          },
          addBeforeFrame: (callback: CallbackFrame) => {
            beforeFrameChildren.push(callback)
          },
          addAfterFrame: (callback: CallbackFrame) => {
            afterFrameChildren.push(callback)
          }
        })

        showSlot.value = true
      }
    }
  },
  render() {
    return h(
      'div',
      {
        id: this.UUID,
        style: { position: 'relative' }
      },
      this.showSlot && this.$slots.default ? this.$slots.default() : undefined
    )
  },
  props: {
    modelValue: {
      type: Object as PropType<THREE.Scene>
    },
    renderer: {
      type: Object as PropType<THREE.WebGLRenderer>
    },
    bgColor: {
      type: String
    },
    bgImage: {
      type: String
    },
    camera: {
      type: Object as PropType<THREE.Camera>
    },
    light: {
      type: Object as PropType<THREE.Light>
    },
    axesHelper: {
      type: Object as PropType<THREE.AxesHelper>
    },
    controls: {
      type: Object as PropType<OrbitControls>
    }
  },
  mounted() {
    this.init()
  }
})
