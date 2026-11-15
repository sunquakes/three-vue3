import type { Renderer } from 'three/webgpu'

declare global {
  /**
   * Unified renderer type accepted by the library. Covers both the default
   * WebGPU renderer (`three/webgpu`) and a classic `WebGLRenderer`, which are
   * structurally compatible for the surface used here.
   */
  type R3LRenderer = Renderer & {
    readonly isWebGLRenderer?: boolean
    readonly isWebGPURenderer?: boolean
  }

  type CallbackFrame = (
    renderer: R3LRenderer,
    scene: THREE.Scene,
    components: SceneComponents,
    delta: number
  ) => void

  type SceneComponents = {
    renderer?: R3LRenderer
    camera?: THREE.Camera
    light?: THREE.Object3D
    axesHelper?: THREE.AxesHelper | undefined | boolean
    gridHelper?: THREE.GridHelper | undefined | boolean
    controls?: OrbitControls | undefined | boolean
    geo?: import('../crs/GeoReference').GeoReference
  }

  type SceneSlotProps = {
    container?: HTMLElement
    renderer?: R3LRenderer
    scene?: THREE.Scene
    sceneComponents?: SceneComponents
    geo?: import('../crs/GeoReference').GeoReference
    picker?: import('../utils/Picker').default
    setFrame?: (callback: CallbackFrame) => void
    resetFrame?: () => void
    addBeforeFrame?: (callback: CallbackFrame) => () => void
    addAfterFrame?: (callback: CallbackFrame) => () => void
  }

  type Array3 = [number, number, number]

  type Array4 = [number, number, number, number]

  type Position = Array3

  type LoadEvent = {
    type: string
    progress: number
  }

  type WaveCircleMeshOptions = {
    radius?: number
    color?: Array4
    speed?: number
    verticalAxis?: AxisType
  }

  type FlowLineMeshOptions = {
    points?: THREE.Vector3[]
    color?: Array4
    arrowColor?: Array3
    speed?: number
    width?: number
    axis?: AxisType
    textureRepeat?: number
  }
}

export {}
