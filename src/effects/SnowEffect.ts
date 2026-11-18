import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
  vec3,
  vec4,
  uv,
  attribute,
  positionLocal,
  modelViewMatrix,
  cameraProjectionMatrix,
  varying,
  mod,
  smoothstep,
  oneMinus,
  sin,
  cos,
  min,
  max,
  mx_noise_float,
  texture,
  viewportSize
} from 'three/tsl'
import { SnowCover } from '../utils/SnowCover'

export interface SnowEffectOptions {
  /** Number of snowflakes, default: 3000 */
  count?: number
  /** Flake color, default: 0xffffff */
  color?: string | number | THREE.Color
  /** Fall speed multiplier, default: 0.5 */
  speed?: number
  /** Width and depth of the snow volume, default: 20 */
  range?: number
  /** Height of the snow volume, default: 15 */
  height?: number
  /** Constant wind on the X axis, default: 0.2 */
  windX?: number
  /** Constant wind on the Z axis, default: 0.1 */
  windZ?: number
  /** Gust and flutter strength, default: 0.8 */
  turbulence?: number
  /** Flake opacity, default: 0.9 */
  opacity?: number
  /** Flake size multiplier, default: 1 */
  size?: number
  /** Let snow settle on scene meshes, default: false */
  accumulate?: boolean
  /** Meshes that collect snow; defaults to every eligible mesh in the scene */
  accumulationTargets?: THREE.Object3D | THREE.Object3D[]
  /** Maximum settled snow thickness in world units, default: 0.1 */
  accumulationThickness?: number
  /** Seconds required to reach full thickness, default: 6 */
  accumulationDuration?: number
  /** Settled snow color, default: 0xffffff */
  accumulationColor?: string | number | THREE.Color
}

function createFallbackTexture(): THREE.Texture {
  const data = new Uint8Array([255, 255, 255, 255])
  const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  fallback.needsUpdate = true
  return fallback
}

function createSnowTexture(): THREE.Texture {
  if (typeof document === 'undefined') return createFallbackTexture()

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return createFallbackTexture()

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const cosAngle = Math.cos(angle)
    const sinAngle = Math.sin(angle)

    ctx.beginPath()
    ctx.moveTo(32, 32)
    ctx.lineTo(32 + cosAngle * 26, 32 + sinAngle * 26)
    ctx.stroke()

    for (const distance of [10, 18]) {
      const bx = 32 + cosAngle * distance
      const by = 32 + sinAngle * distance
      const branchAngle = Math.PI / 6
      const branchLength = 5

      for (const sign of [-1, 1]) {
        const ba = angle + sign * branchAngle
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + Math.cos(ba) * branchLength, by + Math.sin(ba) * branchLength)
        ctx.stroke()
      }
    }
  }

  return new THREE.CanvasTexture(canvas)
}

/**
 * Reference-matched GPU snowfall using instanced, camera-facing snowflake
 * quads. Flake motion, fading and perspective size are evaluated in TSL; the
 * class advances its own clock once added to a scene. update(delta) remains
 * available when a caller needs to drive the timeline explicitly.
 */
export default class SnowEffect {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, NodeMaterial>
  private readonly material: NodeMaterial
  private readonly snowTexture: THREE.Texture
  private readonly timeUniform = uniform(0)
  private readonly options: SnowEffectOptions
  private cover: SnowCover | null = null
  private coverScene: THREE.Scene | null = null
  private animationId: number | null = null
  private lastTime = 0
  private disposed = false

  constructor(options: SnowEffectOptions = {}) {
    this.options = { ...options }
    const {
      count = 3000,
      color: flakeColor = 0xffffff,
      speed = 0.5,
      range = 20,
      height = 15,
      windX = 0.2,
      windZ = 0.1,
      turbulence = 0.8,
      opacity = 0.9,
      size = 1
    } = options

    const geometry = new THREE.InstancedBufferGeometry()
    geometry.instanceCount = count

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    geometry.setIndex([0, 1, 2, 0, 2, 3])

    const offsets = new Float32Array(count * 3)
    const scales = new Float32Array(count * 3)
    const rotations = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * range
      offsets[i * 3 + 1] = Math.random() * height
      offsets[i * 3 + 2] = (Math.random() - 0.5) * range

      scales[i * 3] = (0.028 + Math.random() * 0.047) * size
      scales[i * 3 + 1] = scales[i * 3]
      scales[i * 3 + 2] = 1

      rotations[i * 3] = Math.random() * Math.PI * 2
      rotations[i * 3 + 1] = 0.5 + Math.random() * 2
      rotations[i * 3 + 2] = Math.random()
    }

    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 3))
    geometry.setAttribute('aRotation', new THREE.InstancedBufferAttribute(rotations, 3))

    const uTime = this.timeUniform
    const uColor = uniform(new THREE.Color(flakeColor))
    const uOpacity = uniform(opacity)
    const uSizeScale = uniform(1)
    const uHeight = uniform(height)

    this.snowTexture = createSnowTexture()
    this.material = new NodeMaterial()
    this.material.transparent = true
    this.material.depthWrite = false
    this.material.side = THREE.DoubleSide
    this.material.blending = THREE.NormalBlending

    const vAlpha = varying(float(0), 'vAlpha')
    const vScaleY = varying(float(1), 'vScaleY')

    this.material.vertexNode = Fn(() => {
      const offset = attribute<'vec3'>('aOffset', 'vec3')
      const scale = attribute<'vec3'>('aScale', 'vec3')
      const rotation = attribute<'vec3'>('aRotation', 'vec3')

      const phase = rotation.z
      const fallSpeed = phase.mul(0.8).add(0.6).mul(speed)
      const fallDistance = uTime.mul(fallSpeed).mul(3)
      const yRaw = offset.y.sub(fallDistance)
      const y = mod(yRaw, uHeight)
      const normY = y.div(uHeight)

      const fadeIn = smoothstep(float(0.92), float(1.0), normY)
      const fadeOut = oneMinus(smoothstep(float(0.0), float(0.06), normY))
      vAlpha.assign(fadeIn.mul(fadeOut))
      vScaleY.assign(scale.y)

      const windDrift = uTime.mul(windX)
      const windDriftZ = uTime.mul(windZ)

      const noiseCoord = vec3(
        offset.x.mul(0.15),
        uTime.mul(0.3).add(phase.mul(10)),
        offset.z.mul(0.15)
      )
      const gust = mx_noise_float(noiseCoord).mul(turbulence)
      const gustZ = mx_noise_float(noiseCoord.add(vec3(31.7, 0, 17.3))).mul(turbulence)

      const swayX = sin(uTime.mul(rotation.y).add(rotation.x)).mul(0.35).mul(turbulence)
      const swayZ = cos(uTime.mul(rotation.y).add(rotation.x).mul(0.7)).mul(0.25).mul(turbulence)

      const xRaw = offset.x.add(windDrift).add(swayX).add(gust)
      const zRaw = offset.z.add(windDriftZ).add(swayZ).add(gustZ)
      const x = mod(xRaw.add(range / 2), float(range)).sub(range / 2)
      const z = mod(zRaw.add(range / 2), float(range)).sub(range / 2)

      const center = vec3(x, y, z)
      const localPos = vec3(positionLocal.x.mul(scale.x), positionLocal.y.mul(scale.y), 0)

      const spinAngle = uTime.mul(rotation.y.mul(0.4)).add(rotation.x)
      const cosSpin = cos(spinAngle)
      const sinSpin = sin(spinAngle)
      const spunX = localPos.x.mul(cosSpin).sub(localPos.y.mul(sinSpin))
      const spunY = localPos.x.mul(sinSpin).add(localPos.y.mul(cosSpin))
      const spun = vec3(spunX, spunY, 0)

      const viewCenter = modelViewMatrix.mul(vec4(center, 1.0))
      const viewPos = viewCenter.xyz.add(spun)
      const clip = cameraProjectionMatrix.mul(vec4(viewPos, 1.0))

      const screenSize = viewportSize
      const pixelSize = max(spunY.abs().mul(uSizeScale), float(0.001))
      const minPixel = float(0.8)
      const pixelCorrection = max(minPixel.div(pixelSize.mul(screenSize.y).mul(0.5)), float(1.0))
      const scaleCorr = min(pixelCorrection, float(30.0))

      const correctedSpun = vec3(spunX.mul(scaleCorr), spunY.mul(scaleCorr), 0)
      const correctedView = viewCenter.xyz.add(correctedSpun)
      return cameraProjectionMatrix.mul(vec4(correctedView, 1.0))
    })()

    this.material.fragmentNode = Fn(() => {
      const texColor = texture(this.snowTexture, uv())
      const alpha = texColor.a.mul(vAlpha).mul(uOpacity)
      const finalColor = texColor.rgb.mul(uColor)
      return vec4(finalColor, alpha)
    })()

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.name = 'SnowEffect'
    this.mesh.frustumCulled = false
    this.mesh.raycast = () => undefined
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      this.mesh.position.set(camera.position.x, 0, camera.position.z)
      this.ensureCover(scene, renderer)
    }
    this.mesh.addEventListener('added', this.handleAdded)
    this.mesh.addEventListener('removed', this.handleRemoved)
  }

  update(delta: number): void {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) return
    this.timeUniform.value += delta
    this.cover?.update(delta)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopAnimation()
    this.cover?.dispose()
    this.cover = null
    this.coverScene = null
    this.mesh.removeEventListener('added', this.handleAdded)
    this.mesh.removeEventListener('removed', this.handleRemoved)
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.snowTexture.dispose()
    this.mesh.removeFromParent()
  }

  private ensureCover(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    if (
      !this.options.accumulate ||
      this.disposed ||
      (this.cover !== null && this.coverScene === scene)
    ) {
      return
    }

    this.cover?.dispose()
    this.coverScene = scene
    this.cover = new SnowCover({
      scene,
      targets: this.options.accumulationTargets,
      thickness: this.options.accumulationThickness,
      duration: this.options.accumulationDuration,
      color: this.options.accumulationColor,
      renderer: renderer as THREE.WebGLRenderer & { isWebGPURenderer?: boolean }
    })
  }

  private handleAdded = (): void => {
    this.startAnimation()
  }

  private handleRemoved = (): void => {
    this.stopAnimation()
  }

  private startAnimation(): void {
    if (this.disposed || this.animationId !== null || typeof requestAnimationFrame !== 'function') {
      return
    }

    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame(this.tick)
  }

  private stopAnimation(): void {
    if (this.animationId === null) return
    cancelAnimationFrame(this.animationId)
    this.animationId = null
  }

  private tick = (): void => {
    this.animationId = null
    if (this.disposed) return

    const now = performance.now()
    const delta = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    this.update(delta)

    if (!this.disposed && this.mesh.parent) {
      this.animationId = requestAnimationFrame(this.tick)
    }
  }
}
