import { defineComponent, onBeforeUnmount, onMounted, watch, type PropType } from 'vue'
import * as THREE from 'three'
import {
  reflector,
  screenUV,
  sRGBTransferOETF,
  texture,
  uniform,
  viewportSafeUV,
  viewportSharedTexture
} from 'three/tsl'
import type { Node } from 'three/webgpu'
import { useScene } from '../context/SceneContext'
import { createWaterMaterial, type WaterMaterialSamplers } from '../utils/WaterMaterial'
import { createNoiseTexture } from '../utils/WaterNoise'
import { updateMirrorCamera } from '../utils/WaterReflection'
import { sampleOceanSurface } from '../utils/WaterSpectrum'
import type { WaterPoolOutline } from '../utils/WaterPoolShape'
import {
  createWaterSurfaceGeometry,
  resolveWaterSurfaceShape
} from '../utils/WaterSurfaceGeometry'
import { globalParameterBus } from '../utils/ParameterBus'

export interface WaterProps {
  /** Longest edge of the planar captures, in device pixels. */
  captureResolution?: number
  /** Plane subdivisions per axis. When `shape` is set, the total boundary budget. */
  segments?: number
  /** Size of the water patch, in world units. Ignored when `shape` is set. */
  size?: number
  /**
   * Custom water outline. Pass convex `[x, z]` points in world units, or a
   * `THREE.BufferGeometry` such as `ConvexGeometry`; geometry vertices are
   * projected onto the XZ plane. Both are reduced to their convex hull and the
   * outline must contain the origin. The surface then follows the outline
   * instead of the square plane.
   */
  shape?: WaterPoolOutline | THREE.BufferGeometry
  /** World position of the water surface centre. Defaults to [0, 0, 0]. */
  position?: THREE.Vector3 | [number, number, number]
  /** Optional explicit scene, useful when the component is mounted imperatively. */
  scene?: THREE.Scene
}

const MIN_CAPTURE_SCALE = 0.14
const MAX_CAPTURE_SCALE = 0.42
const UNDERWATER_CAPTURE_SKIP = 0.65
const UNDERWATER_EASING = 0.085

/** Cinematic ocean surface with planar captures on both renderer backends. */
export default defineComponent({
  name: 'TvWater',
  props: {
    captureResolution: {
      type: Number,
      default: 512
    },
    segments: {
      type: Number,
      default: 240
    },
    size: {
      type: Number,
      default: 420
    },
    shape: {
      type: [Array, Object] as PropType<WaterPoolOutline | THREE.BufferGeometry>,
      default: undefined
    },
    position: {
      type: [Object, Array] as PropType<THREE.Vector3 | [number, number, number]>,
      default: undefined
    },
    scene: {
      type: Object as PropType<THREE.Scene>,
      default: undefined
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let animationId: number | null = null
    let disposeScene: (() => void) | null = null
    let mesh: THREE.Mesh | null = null
    let geometry: THREE.BufferGeometry | null = null

    const createGeometry = () =>
      props.shape
        ? createWaterSurfaceGeometry(
            props.segments,
            resolveWaterSurfaceShape(props.shape as WaterPoolOutline | THREE.BufferGeometry)
          )
        : new THREE.PlaneGeometry(props.size, props.size, props.segments, props.segments).rotateX(
            -Math.PI / 2
          )

    function destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
      disposeScene?.()
      disposeScene = null
      mesh = null
      geometry = null
    }

    function create() {
      destroy()

      const { renderer, sceneComponents, container } = sceneContext
      const scene = props.scene ?? sceneContext.scene
      if (!renderer || !scene || !sceneComponents?.camera) return

      const camera = sceneComponents.camera as THREE.PerspectiveCamera
      const isWebGPU = renderer.isWebGPURenderer === true
      const noiseTexture = createNoiseTexture()
      const uTime = uniform(0)
      const uUnderwater = uniform(0)
      const uSunDirection = uniform(globalParameterBus.get('sunDirection').clone())
      const stopSunDirection = globalParameterBus.subscribe('sunDirection', (direction) => {
        uSunDirection.value.copy(direction).normalize()
      })

      geometry = createGeometry()
      const drawingSize = new THREE.Vector2()
      const computeCaptureScale = () => {
        renderer.getDrawingBufferSize(drawingSize)
        return THREE.MathUtils.clamp(
          props.captureResolution / Math.max(drawingSize.width, drawingSize.height, 1),
          MIN_CAPTURE_SCALE,
          MAX_CAPTURE_SCALE
        )
      }
      const computeCaptureSize = () => {
        const scale = computeCaptureScale()
        renderer.getDrawingBufferSize(drawingSize)
        return {
          width: Math.max(1, Math.round(drawingSize.width * scale)),
          height: Math.max(1, Math.round(drawingSize.height * scale))
        }
      }

      let reflectionSampler: ReturnType<typeof reflector> | null = null
      let reflectionTarget: THREE.WebGLRenderTarget | null = null
      let refractionTarget: THREE.WebGLRenderTarget | null = null
      let samplers: WaterMaterialSamplers

      if (isWebGPU) {
        const sampler = reflector({ bounces: false, samples: 0 })
        sampler.reflector.resolutionScale = computeCaptureScale()
        sampler.target.rotation.x = -Math.PI / 2
        reflectionSampler = sampler
        samplers = {
          sampleReflection: (distortion) => {
            const baseUv = sampler.uvNode ?? screenUV.flipX()
            sampler.uvNode = baseUv.add(distortion)
            return sampler.rgb
          },
          sampleRefraction: (offset) =>
            viewportSharedTexture(viewportSafeUV(screenUV.sub(offset))).rgb
        }
      } else {
        const captureSize = computeCaptureSize()
        const reflection = new THREE.WebGLRenderTarget(captureSize.width, captureSize.height, {
          type: THREE.HalfFloatType,
          samples: 0
        })
        const refraction = new THREE.WebGLRenderTarget(captureSize.width, captureSize.height, {
          type: THREE.HalfFloatType,
          samples: 0
        })
        reflectionTarget = reflection
        refractionTarget = refraction
        samplers = {
          sampleReflection: (distortion) =>
            texture(reflection.texture, screenUV.flipX().add(distortion)).rgb,
          sampleRefraction: (offset) =>
            sRGBTransferOETF(texture(refraction.texture, screenUV.sub(offset)).rgb) as Node<'vec3'>
        }
      }

      const material = createWaterMaterial({
        timeNode: uTime,
        underwaterNode: uUnderwater,
        noiseMap: noiseTexture,
        sunDirection: uSunDirection,
        samplers
      })
      const water = new THREE.Mesh(geometry, material)
      water.name = 'OceanWater'
      water.frustumCulled = false
      water.renderOrder = 5
      water.position.fromArray(
        props.position instanceof THREE.Vector3
          ? props.position.toArray()
          : (props.position ?? [0, 0, 0])
      )
      if (reflectionSampler) water.add(reflectionSampler.target)
      scene.add(water)
      mesh = water

      const mirrorCamera = camera.clone()
      const captureViews = () => {
        if (!reflectionTarget || !refractionTarget) return
        const previousRenderTarget = renderer.getRenderTarget()
        water.visible = false
        renderer.setRenderTarget(refractionTarget)
        renderer.clear()
        renderer.render(scene, camera)
        if (updateMirrorCamera(camera, water, mirrorCamera)) {
          renderer.setRenderTarget(reflectionTarget)
          renderer.clear()
          renderer.render(scene, mirrorCamera)
        }
        renderer.setRenderTarget(previousRenderTarget)
        water.visible = true
      }

      let resizeObserver: ResizeObserver | undefined
      if (container) {
        resizeObserver = new ResizeObserver(() => {
          if (isWebGPU) {
            if (reflectionSampler) {
              reflectionSampler.reflector.resolutionScale = computeCaptureScale()
            }
            return
          }
          const captureSize = computeCaptureSize()
          reflectionTarget?.setSize(captureSize.width, captureSize.height)
          refractionTarget?.setSize(captureSize.width, captureSize.height)
        })
        resizeObserver.observe(container)
      }

      // A dedicated loop keeps the existing Scene render path intact on both
      // backends; planar captures intentionally reuse the previous frame.
      const startTimestamp = performance.now()
      let underwaterMix = 0
      const animate = () => {
        const elapsed = (performance.now() - startTimestamp) / 1000
        uTime.value = elapsed
        const cameraSurface = sampleOceanSurface(
          camera.position.x - water.position.x,
          camera.position.z - water.position.z,
          elapsed
        )
        const underwaterTarget = camera.position.y < water.position.y + cameraSurface.height ? 1 : 0
        underwaterMix = THREE.MathUtils.lerp(underwaterMix, underwaterTarget, UNDERWATER_EASING)
        uUnderwater.value = underwaterMix
        if (!isWebGPU && underwaterMix < UNDERWATER_CAPTURE_SKIP) captureViews()
        animationId = requestAnimationFrame(animate)
      }
      animationId = requestAnimationFrame(animate)

      disposeScene = () => {
        stopSunDirection()
        resizeObserver?.disconnect()
        water.removeFromParent()
        water.geometry.dispose()
        material.dispose()
        noiseTexture.dispose()
        reflectionSampler?.dispose()
        reflectionTarget?.dispose()
        refractionTarget?.dispose()
      }
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    watch(
      () => props.position,
      (position) => {
        mesh?.position.fromArray(
          position instanceof THREE.Vector3 ? position.toArray() : (position ?? [0, 0, 0])
        )
      }
    )
    watch(
      () => [props.shape, props.segments] as const,
      () => {
        if (!mesh || !geometry) return
        const nextGeometry = createGeometry()
        mesh.geometry = nextGeometry
        geometry.dispose()
        geometry = nextGeometry
      }
    )
  },
  render() {
    return null
  }
})
