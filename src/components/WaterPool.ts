import { defineComponent, onBeforeUnmount, onMounted, watch, type PropType } from 'vue'
import * as THREE from 'three'
import { uniform } from 'three/tsl'
import { useScene } from '../context/SceneContext'
import { WaterPoolSimulation } from '../utils/WaterPoolSimulation'
import {
  createWaterPoolEdges,
  getWaterPoolBounds,
  isInsideWaterPool,
  resolveWaterPoolShape,
  WATER_POOL_IRREGULAR_CUBE_OUTLINE,
  type WaterPoolEdge,
  type WaterPoolOutline,
  type WaterPoolShape
} from '../utils/WaterPoolShape'
import { createWaterSurfaceGeometry } from '../utils/WaterSurfaceGeometry'
import { createWaterPoolMaterials } from '../utils/WaterPoolMaterials'
import { globalParameterBus } from '../utils/ParameterBus'

export interface WaterPoolProps {
  /** Height-field cells per axis, from 8 to 512. Defaults to 128. */
  resolution?: number
  /**
   * Container outline. The default is the irregular cube outline, a skewed
   * quadrilateral. `'box'` gives the square tub, or pass convex `[x, z]` points
   * counter-clockwise that contain the origin and stay within -1…1.
   * A `THREE.BufferGeometry` such as `ConvexGeometry` works too: its vertices
   * are projected onto the XZ plane and reduced to their convex hull.
   */
  shape?: WaterPoolShape
  /** Subdivisions around the container outline. Defaults to 160. */
  segments?: number
  /** Adds a small random ripple every so often. Defaults to true. */
  autoRipples?: boolean
  /** Enables dragging the water surface. Defaults to true. */
  interactive?: boolean
  /** World position of the water surface centre. Defaults to [0, 0, 0]. */
  position?: THREE.Vector3 | [number, number, number]
  /** Uniform scale of the pool and its depth. Defaults to 1. */
  scale?: number
  /** Optional explicit scene, useful when the component is mounted imperatively. */
  scene?: THREE.Scene
}

const DROP_RADIUS = 0.06
const DROP_STRENGTH = 0.01
const INITIAL_DROPS = 20
const AUTO_RIPPLE_INTERVAL = 1.8
const FIXED_STEP = 1 / 60
const MAX_STEPS_PER_FRAME = 3
const DRAG_STRENGTH = 0.01

/** Random point inside the outline, used for the initial and ambient ripples. */
const randomPoolPoint = (
  outline: WaterPoolOutline,
  edges: readonly WaterPoolEdge[]
): [number, number] => {
  const { minX, maxX, minZ, maxZ } = getWaterPoolBounds(outline)
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)
    if (isInsideWaterPool(x, z, edges, 0.03)) {
      return [x, z]
    }
  }

  return [0, 0]
}

export default defineComponent({
  name: 'WaterPool',
  props: {
    resolution: {
      type: Number,
      default: 128
    },
    shape: {
      type: [String, Array, Object] as PropType<WaterPoolShape>,
      default: undefined
    },
    segments: {
      type: Number,
      default: 160
    },
    autoRipples: {
      type: Boolean,
      default: true
    },
    interactive: {
      type: Boolean,
      default: true
    },
    position: {
      type: [Object, Array] as PropType<THREE.Vector3 | [number, number, number]>,
      default: undefined
    },
    scale: {
      type: Number,
      default: 1
    },
    scene: {
      type: Object as PropType<THREE.Scene>,
      default: undefined
    }
  },
  setup(props) {
    const sceneContext = useScene()
    let camera: THREE.Camera | undefined
    let renderer: SceneSlotProps['renderer']
    let controls: SceneComponents['controls']

    const uLightDirection = uniform(new THREE.Vector3(-0.78, 0.2, -0.6).normalize())
    const uPoolCenter = uniform(new THREE.Vector3())
    const uPoolScale = uniform(1)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hitPoint = new THREE.Vector3()
    const poolRay = new THREE.Ray()

    let simulation: WaterPoolSimulation | undefined
    let materials: ReturnType<typeof createWaterPoolMaterials> | undefined
    let mesh: THREE.Mesh | undefined
    let geometry: THREE.BufferGeometry | undefined
    let poolOutline: WaterPoolOutline = WATER_POOL_IRREGULAR_CUBE_OUTLINE
    let poolEdges: WaterPoolEdge[] = createWaterPoolEdges(poolOutline)
    let poolCenter = new THREE.Vector3()
    let poolScale = 1
    let canvas: HTMLCanvasElement | undefined
    let dragging = false
    let controlsDisabled = false
    let lastTime = performance.now()
    let accumulator = 0
    let rippleTimer = 0
    let frameId = 0
    let stopSunDirection: (() => void) | undefined
    let disposed = false

    const syncPoolTransform = () => {
      poolCenter =
        props.position instanceof THREE.Vector3
          ? props.position.clone()
          : new THREE.Vector3().fromArray(props.position ?? [0, 0, 0])
      poolScale = props.scale
      if (mesh) {
        mesh.position.copy(poolCenter)
        mesh.scale.setScalar(poolScale)
      }
      uPoolCenter.value.copy(poolCenter)
      uPoolScale.value = poolScale
    }

    const rebuildGeometry = () => {
      if (disposed) return
      poolOutline = resolveWaterPoolShape(props.shape ?? WATER_POOL_IRREGULAR_CUBE_OUTLINE)
      poolEdges = createWaterPoolEdges(poolOutline)
      const nextGeometry = createWaterSurfaceGeometry(props.segments, poolOutline)
      if (mesh) mesh.geometry = nextGeometry
      geometry?.dispose()
      geometry = nextGeometry
    }

    const getRay = (event: PointerEvent): THREE.Ray | null => {
      if (!canvas || !camera) return null
      const bounds = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
        -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      return raycaster.ray
    }

    const toPoolRay = (ray: THREE.Ray) => {
      poolRay.origin.copy(ray.origin).sub(poolCenter).divideScalar(poolScale)
      poolRay.direction.copy(ray.direction)
      return poolRay
    }

    const intersectWater = (ray: THREE.Ray, target: THREE.Vector3) => {
      if (Math.abs(ray.direction.y) < 1e-6) return false
      const distance = -ray.origin.y / ray.direction.y
      if (distance <= 0) return false
      target.copy(ray.origin).addScaledVector(ray.direction, distance)
      return isInsideWaterPool(target.x, target.z, poolEdges)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const ray = getRay(event)
      if (ray && intersectWater(toPoolRay(ray), hitPoint)) {
        simulation?.addDrop(hitPoint.x, hitPoint.z, DROP_RADIUS, DRAG_STRENGTH)
      }
      event.preventDefault()
    }

    const onPointerUp = () => {
      dragging = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (controlsDisabled) {
        if (controls && typeof controls !== 'boolean') controls.enabled = true
        controlsDisabled = false
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!props.interactive || event.button !== 0 || dragging || !canvas) return
      if (!canvas.contains(event.target as Node)) return

      const ray = getRay(event)
      if (!ray || !intersectWater(toPoolRay(ray), hitPoint)) return
      dragging = true
      simulation?.addDrop(hitPoint.x, hitPoint.z, DROP_RADIUS, DRAG_STRENGTH)

      controlsDisabled = true
      if (controls && typeof controls !== 'boolean') controls.enabled = false
      event.stopImmediatePropagation()
      event.preventDefault()

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }

    const frame = () => {
      if (!simulation || disposed) return
      const now = performance.now()
      const delta = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      if (props.autoRipples) {
        rippleTimer += delta
        if (rippleTimer >= AUTO_RIPPLE_INTERVAL) {
          rippleTimer = 0
          const [dropX, dropZ] = randomPoolPoint(poolOutline, poolEdges)
          simulation.addDrop(
            dropX,
            dropZ,
            DROP_RADIUS,
            Math.random() < 0.5 ? DROP_STRENGTH * 0.8 : -DROP_STRENGTH * 0.8
          )
        }
      }

      accumulator += delta
      let steps = 0
      while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
        accumulator -= FIXED_STEP
        simulation.step(2)
        simulation.updateNormals()
        steps += 1
      }

      if (steps > 0) {
        simulation.syncWaterTexture()
        simulation.waterTexture.needsUpdate = true
      }

      frameId = requestAnimationFrame(frame)
    }

    const cleanup = () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (controlsDisabled && controls && typeof controls !== 'boolean') {
        controls.enabled = true
      }
      dragging = false
      controlsDisabled = false
      canvas = undefined

      stopSunDirection?.()
      stopSunDirection = undefined
      simulation?.dispose()
      mesh?.removeFromParent()
      geometry?.dispose()
      materials?.water.dispose()

      simulation = undefined
      materials = undefined
      mesh = undefined
      geometry = undefined
    }

    const setupScene = (scene: THREE.Scene) => {
      if (mesh || simulation || disposed || !renderer || !camera) return
      dragging = false
      controlsDisabled = false
      simulation = new WaterPoolSimulation({ resolution: props.resolution })
      rebuildGeometry()
      for (let index = 0; index < INITIAL_DROPS; index += 1) {
        const [dropX, dropZ] = randomPoolPoint(poolOutline, poolEdges)
        simulation.addDrop(
          dropX,
          dropZ,
          DROP_RADIUS,
          index % 2 === 0 ? DROP_STRENGTH : -DROP_STRENGTH
        )
      }
      simulation.updateNormals()
      simulation.syncWaterTexture()
      simulation.waterTexture.needsUpdate = true

      uLightDirection.value.copy(globalParameterBus.get('sunDirection')).normalize()
      stopSunDirection = globalParameterBus.subscribe('sunDirection', (direction) => {
        uLightDirection.value.copy(direction).normalize()
      })

      materials = createWaterPoolMaterials({
        waterTexture: simulation.waterTexture,
        lightDirection: uLightDirection,
        poolCenter: uPoolCenter,
        poolScale: uPoolScale
      })
      mesh = new THREE.Mesh(geometry, materials.water)
      mesh.name = 'WaterPoolSurface'
      mesh.frustumCulled = false
      scene.add(mesh)
      syncPoolTransform()

      watch(() => [props.position, props.scale] as const, syncPoolTransform)
      watch(() => [props.shape, props.segments] as const, rebuildGeometry)

      canvas = renderer.domElement
      window.addEventListener('pointerdown', onPointerDown, true)
      lastTime = performance.now()
      accumulator = 0
      rippleTimer = 0
      frameId = requestAnimationFrame(frame)
    }

    onMounted(() => {
      camera = sceneContext.sceneComponents?.camera
      renderer = sceneContext.renderer
      controls = sceneContext.sceneComponents?.controls
      const scene = props.scene ?? sceneContext.scene
      if (scene) setupScene(scene)
    })

    onBeforeUnmount(() => {
      disposed = true
      cleanup()
    })

    return () => null
  }
})
