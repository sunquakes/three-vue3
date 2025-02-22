declare global {
  type CallbackFrame = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    components: SceneComponents
  ) => void

  type SceneComponents = {
    camera?: THREE.Camera
    light?: THREE.Light
    axesHelper?: THREE.AxesHelper | undefined | boolean
    controls?: OrbitControls | undefined | boolean
  }

  type SceneSlotProps = {
    container?: HTMLElement
    renderer?: THREE.WebGLRenderer
    scene?: THREE.Scene
    sceneComponents?: SceneComponents
    setFrame?: (callback: CallbackFrame) => void
    addBeforeFrame?: (callback: CallbackFrame) => void
    addAfterFrame?: (callback: CallbackFrame) => void
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
}

export {}
