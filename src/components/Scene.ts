import { defineComponent, h, PropType, ref, nextTick, provide, onBeforeUnmount } from 'vue'
import { generateUUID } from '../utils/UUID'
import Scene from '../utils/Scene'
import type { SceneRuntime } from '../utils/Scene'
import Camera, { GIS_CAMERA_FAR } from '../utils/Camera'
import Light from '../utils/Light'
import Renderer from '../utils/Renderer'
import type { RendererType } from '../utils/Renderer'
import AxesHelper from '../utils/AxesHelper'
import Controls from '../utils/Controls'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { sceneContextKey } from '../context/SceneContext'
import { GeoReference } from '../crs/GeoReference'
import type { AxesMapping, CrsCode, DatumType, GeoPoint } from '../crs/types'

export interface GridHelperOptions {
  size?: number
  divisions?: number
  colorCenterLine?: THREE.ColorRepresentation
  colorGrid?: THREE.ColorRepresentation
  y?: number
}

const DEFAULT_GRID_OPTIONS: Required<GridHelperOptions> = {
  size: 20,
  divisions: 20,
  colorCenterLine: 0xbbbbbb,
  colorGrid: 0xdddddd,
  y: 0.01
}

// A GIS scene works in local metres around a geographic origin, so the generic
// 20 m grid is far too small and its y = 0.01 plane is hidden under the opaque
// tile quads (y = 0.05). Scale it to the kilometre range (50 m cells) and lift
// it just above the map plane.
const GIS_GRID_OPTIONS: Required<GridHelperOptions> = {
  size: 2000,
  divisions: 40,
  colorCenterLine: 0x4a6fa5,
  colorGrid: 0x2f3e5c,
  y: 0.1
}

export default defineComponent({
  emits: [
    'update:modelValue',
    'update:renderer',
    'update:camera',
    'update:light',
    'update:axesHelper',
    'update:gridHelper',
    'update:controls',
    'created',
    'beforeFrame',
    'frame',
    'afterFrame'
  ],
  setup(props, { emit }) {
    let UUID = ref()
    const showSlot = ref(false)

    const beforeFrameChildren: Array<CallbackFrame> = []
    const afterFrameChildren: Array<CallbackFrame> = []

    function addBeforeFrame(callback: CallbackFrame) {
      beforeFrameChildren.push(callback)
      beforeFrameSet = true
      return () => {
        const index = beforeFrameChildren.indexOf(callback)
        if (index !== -1) beforeFrameChildren.splice(index, 1)
      }
    }

    function addAfterFrame(callback: CallbackFrame) {
      afterFrameChildren.push(callback)
      return () => {
        const index = afterFrameChildren.indexOf(callback)
        if (index !== -1) afterFrameChildren.splice(index, 1)
      }
    }

    let frameCallbackSet = false
    let beforeFrameSet = false

    const sceneSlotProps: SceneSlotProps = {
      addBeforeFrame,
      addAfterFrame,
      setFrame: (callback: CallbackFrame) => {
        callbackFrame = callback
        frameCallbackSet = true
      },
      resetFrame: () => {
        callbackFrame = defaultFrame
        frameCallbackSet = false
      }
    }
    provide(sceneContextKey, sceneSlotProps)
    // Legacy key kept for components written against earlier versions.
    provide('sceneSlotProps', sceneSlotProps)

    const defaultFrame: CallbackFrame = (
      renderer: R3LRenderer,
      scene: THREE.Scene,
      components: SceneComponents
    ) => {
      if (frameCallbackSet) return
      const camera = components.camera
      if (!camera) return
      if (beforeFrameSet) {
        // A before-frame callback owns the clear (e.g. post-processing), so the
        // background is hidden for the main pass to avoid clearing twice.
        const bg = scene.background
        scene.background = null
        camera.layers.set(0)
        renderer.render(scene, camera)
        scene.background = bg
      } else {
        renderer.clear()
        camera.layers.set(0)
        renderer.render(scene, camera)
      }
    }

    let callbackFrame: CallbackFrame = defaultFrame

    function frame(
      renderer: R3LRenderer,
      scene: THREE.Scene,
      components: SceneComponents,
      delta: number
    ) {
      emit('frame', renderer, scene, components, delta)
      callbackFrame(renderer, scene, components, delta)
    }
    function beforeFrame(
      renderer: R3LRenderer,
      scene: THREE.Scene,
      components: SceneComponents,
      delta: number
    ) {
      emit('beforeFrame', renderer, scene, components, delta)
      beforeFrameChildren.forEach((beforeFrameChild) => {
        beforeFrameChild?.(renderer, scene, components, delta)
      })
    }
    function afterFrame(
      renderer: R3LRenderer,
      scene: THREE.Scene,
      components: SceneComponents,
      delta: number
    ) {
      emit('afterFrame', renderer, scene, components, delta)
      afterFrameChildren.forEach((afterFrameChild) => {
        afterFrameChild?.(renderer, scene, components, delta)
      })
    }

    let runtime: SceneRuntime | undefined
    let autoRenderer: R3LRenderer | undefined
    let autoControls: OrbitControls | undefined

    onBeforeUnmount(() => {
      runtime?.dispose()
      runtime = undefined
      autoControls?.dispose()
      autoControls = undefined
      autoRenderer?.dispose()
      autoRenderer = undefined
    })

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
        // A GeoReference always exists: when no GIS props are supplied it is the
        // default WGS84/equirectangular reference centred at (0, 0), which is a
        // no-op for every non-geographic scene.
        const geo =
          props.geo ??
          new GeoReference(props.origin, {
            ...(props.crs !== undefined ? { crs: props.crs } : {}),
            ...(props.datum !== undefined ? { datum: props.datum } : {}),
            ...(props.axes !== undefined ? { axes: props.axes } : {})
          })

        // A scene built from any geographic prop works in local metres around a
        // geographic origin and spans kilometres, so both the default camera far
        // plane and the built-in grid need kilometre-range defaults. A scene with
        // none of these props keeps the compact generic defaults.
        const isGisScene =
          props.geo !== undefined ||
          props.origin !== undefined ||
          props.crs !== undefined ||
          props.datum !== undefined ||
          props.axes !== undefined

        if (renderer == undefined) {
          renderer = Renderer(props.rendererType)
          autoRenderer = renderer
          emit('update:renderer', renderer)
        }
        let camera = props.camera
        if (camera == undefined) {
          camera = Camera(container, isGisScene ? { far: GIS_CAMERA_FAR } : undefined)
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
        // r3l draws a compact grey grid by default; pass `grid-helper="false"`
        // to hide it or an object to customise size, divisions, colors and y.
        let gridHelper: THREE.GridHelper | undefined
        if (props.gridHelper === false) {
          gridHelper = undefined
        } else if (props.gridHelper instanceof THREE.GridHelper) {
          gridHelper = props.gridHelper
        } else {
          const options = props.gridHelper === true ? undefined : props.gridHelper
          const { size, divisions, colorCenterLine, colorGrid, y } = {
            ...(isGisScene ? GIS_GRID_OPTIONS : DEFAULT_GRID_OPTIONS),
            ...(options ?? {})
          }
          gridHelper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid)
          gridHelper.position.y = y
        }
        let controls = props.controls
        if (controls === undefined) {
          controls = Controls(camera, renderer)
          autoControls = controls
          emit('update:controls', controls)
        }
        const sceneComponents: SceneComponents = {
          renderer: renderer,
          camera: camera,
          light: light,
          axesHelper: axesHelper,
          gridHelper: gridHelper,
          controls: controls,
          geo: geo
        }
        try {
          runtime = await Scene(renderer, container, sceneComponents, frame, beforeFrame, afterFrame)
        } catch (err) {
          console.error('[three-vue3] Failed to initialize renderer:', err)
          return
        }
        const scene = runtime.scene
        if (props.bgImage != undefined) {
          const textureLoader = new THREE.TextureLoader()
          textureLoader.load(
            props.bgImage,
            (texture) => {
              // Background textures must be in SRGBColorSpace for correct
              // color display in both WebGL and WebGPU.
              texture.colorSpace = THREE.SRGBColorSpace
              scene.background = texture
            },
            undefined,
            (error) => {
              console.error('Failed to load background image:', props.bgImage, error)
            }
          )
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
          geo: geo
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
      type: Object as PropType<R3LRenderer>
    },
    rendererType: {
      type: String as PropType<RendererType>,
      default: 'webgpu'
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
      type: Object as PropType<THREE.Object3D>
    },
    axesHelper: {
      type: [Object, Boolean] as PropType<THREE.AxesHelper | boolean>
    },
    gridHelper: {
      type: [Object, Boolean] as PropType<THREE.GridHelper | GridHelperOptions | boolean>
    },
    controls: {
      type: Object as PropType<OrbitControls>
    },
    /** Explicit GeoReference; overrides `origin`/`crs`/`datum`/`axes`. */
    geo: {
      type: Object as PropType<GeoReference>
    },
    /** Geographic origin (lng/lat/alt) of the local metre frame. */
    origin: {
      type: Object as PropType<GeoPoint>
    },
    /** CRS used for the tangent plane. Defaults to EPSG:4326. */
    crs: {
      type: String as PropType<CrsCode>
    },
    /** Datum of geographic coordinates. Defaults to WGS84. */
    datum: {
      type: String as PropType<DatumType>
    },
    /** Mapping from ENU onto the three.js axes. Defaults to E:+X, N:-Z, U:+Y. */
    axes: {
      type: Object as PropType<AxesMapping>
    }
  },
  mounted() {
    this.init()
  }
})
