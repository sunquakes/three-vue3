import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  cameraProjectionMatrix,
  clamp,
  exp,
  float,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  positionLocal,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  viewportSize
} from 'three/tsl'
import { sampleTextParticles } from './TextSampling'

export interface TextFireworksOptions {
  /** Text sampled into particles, default: 'Good things are coming' */
  text?: string
  /** Burst colours from left to right, default: orange, gold, blue, purple */
  colors?: THREE.ColorRepresentation[]
  /** Burst centre of each group in world units, default: four staggered positions */
  burstCenters?: Array<[number, number]>
  /** Uniform scale applied to burst centres and radial spread, default: 1 */
  burstScale?: number
  /** Seconds between the launches of successive groups, default: 0.22 */
  groupDelay?: number
  /** Extra per-particle delay jitter in seconds, default: 0.2 */
  groupJitter?: number
  /** Particle size in CSS pixels, default: 3.4 */
  pointSize?: number
  /** Seconds the trail layer lags behind the main layer, default: 0.105 */
  trailOffset?: number
  /** Opacity multiplier of the trail layer, default: 0.34 */
  trailOpacity?: number
  /** Colour the letters rest at and fade back to, default: 0xffd4ad */
  restColor?: THREE.ColorRepresentation
  /** World units per sampled canvas pixel, default: 0.0068 */
  worldScale?: number
  /** Vertical offset of the text centre in world units, default: 0.55 */
  offsetY?: number
  /** Play once automatically after the object is created, default: true */
  autoPlay?: boolean
  /** Seconds before the automatic launch, default: 1.2 */
  autoPlayDelay?: number
  /** Seed for the deterministic per-particle randomness, default: 1 */
  seed?: number
}

function createScalarUniform(value: number) {
  return uniform(value)
}

function createColorUniform(value: THREE.Color) {
  return uniform(value)
}

type ScalarUniformNode = ReturnType<typeof createScalarUniform>
type ColorUniformNode = ReturnType<typeof createColorUniform>

interface RendererInfo {
  isWebGPURenderer?: boolean
  getPixelRatio?: () => number
}

const DEFAULT_TEXT = 'Good things are coming'
const DEFAULT_COLORS: THREE.ColorRepresentation[] = [0xff8a3d, 0xffd166, 0x4aa8ff, 0xb06cff]
const DEFAULT_CENTERS: Array<[number, number]> = [
  [-2.35, 2.05],
  [-0.78, 2.5],
  [0.82, 2.1],
  [2.4, 2.55]
]

// Timeline in seconds. Particles lift off at 0, finish reaching their burst
// centres at LIFT_END, then fall back into the glyphs between RETURN_START and
// RETURN_END.
const DURATION = 5.6
const LIFT_END = 0.86
const RETURN_START = 4.25
const RETURN_END = 5.45

const QUAD_CORNERS: Array<[number, number]> = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5]
]
const QUAD_UVS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1]
]

function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Text sampled into a cloud of additive particles. On launch the glyph flies
 * apart into groups of coloured bursts, then every particle is pulled back to
 * the pixel it came from, leaving the readable text on screen again.
 */
export default class TextFireworks extends THREE.Group {
  /** Main particle layer */
  readonly points: THREE.Mesh
  /** Delayed, dimmer copy of the same particles used as a trail */
  readonly trail: THREE.Mesh

  private currentText: string
  private particleCountValue = 0
  private geometry: THREE.BufferGeometry
  private pointsMaterial: NodeMaterial
  private trailMaterial: NodeMaterial
  private baseColors = new Float32Array(0)
  private baseRestColor: THREE.Color
  private colors: THREE.Color[]
  private centers: Array<[number, number]>
  private groupDelay: number
  private groupJitter: number
  private seed: number
  private worldScale: number
  private offsetY: number
  private autoPlayDelay: number

  private readonly uPhase: ScalarUniformNode
  private readonly uBurstScale: ScalarUniformNode
  private readonly uPixelRatio: ScalarUniformNode
  private readonly uRestColor: ColorUniformNode

  private phaseValue = 0
  private animationId: number | null = null
  private autoPlayTimer: ReturnType<typeof setTimeout> | null = null
  private lastTime = 0
  private isWebGPU = false
  private disposed = false

  constructor(options: TextFireworksOptions = {}) {
    super()

    this.name = 'TextFireworks'
    this.currentText = (options.text ?? DEFAULT_TEXT).trim() || DEFAULT_TEXT
    this.worldScale = options.worldScale ?? 0.0068
    this.offsetY = options.offsetY ?? 0.55
    this.groupDelay = options.groupDelay ?? 0.22
    this.groupJitter = options.groupJitter ?? 0.2
    this.autoPlayDelay = options.autoPlayDelay ?? 1.2
    this.seed = options.seed ?? 1

    const colors = options.colors?.length ? options.colors : DEFAULT_COLORS
    const centers = options.burstCenters?.length ? options.burstCenters : DEFAULT_CENTERS
    const groupCount = Math.min(colors.length, centers.length)
    this.colors = colors.slice(0, groupCount).map((color) => new THREE.Color(color))
    this.centers = centers.slice(0, groupCount)

    this.baseRestColor = new THREE.Color(options.restColor ?? 0xffd4ad)
    this.uPhase = createScalarUniform(0)
    this.uBurstScale = createScalarUniform(options.burstScale ?? 1)
    this.uPixelRatio = createScalarUniform(1)
    this.uRestColor = createColorUniform(this.baseRestColor.clone())

    const geometry = this.createGeometry()
    this.geometry = geometry

    const pointSize = options.pointSize ?? 3.4
    this.pointsMaterial = this.createLayerMaterial(pointSize, 0, 1)
    this.trailMaterial = this.createLayerMaterial(
      pointSize * 1.45,
      options.trailOffset ?? 0.105,
      options.trailOpacity ?? 0.34
    )

    this.points = new THREE.Mesh(geometry, this.pointsMaterial)
    this.points.name = 'TextFireworksPoints'
    this.points.frustumCulled = false
    this.points.renderOrder = 2

    this.trail = new THREE.Mesh(geometry, this.trailMaterial)
    this.trail.name = 'TextFireworksTrail'
    this.trail.frustumCulled = false
    this.trail.renderOrder = 1

    this.add(this.trail, this.points)
    this.addEventListener('added', this.handleAdded)

    if (options.autoPlay ?? true) {
      this.autoPlayTimer = setTimeout(() => {
        this.autoPlayTimer = null
        this.launch()
      }, Math.max(0, this.autoPlayDelay) * 1000)
    }
  }

  /** Text currently sampled into the particle cloud */
  get text(): string {
    return this.currentText
  }

  /** Number of glyph particles, each rendered as a billboarded quad */
  get particleCount(): number {
    return this.particleCountValue
  }

  /** Length of one lift-off / burst / return cycle in seconds */
  get duration(): number {
    return DURATION
  }

  /** Current position on the timeline in seconds */
  get phase(): number {
    return this.phaseValue
  }

  /** Whether the timeline is currently advancing */
  get playing(): boolean {
    return this.animationId !== null
  }

  /** Re-sample new text and settle back at rest */
  setText(text: string): void {
    if (this.disposed) return

    const next = text.trim()
    if (!next || next === this.currentText) return

    this.currentText = next
    this.rebuildGeometry()
    this.resetTimeline()
  }

  /** Restart the lift-off / burst / return cycle */
  launch(): void {
    if (this.disposed) return

    if (this.autoPlayTimer !== null) {
      clearTimeout(this.autoPlayTimer)
      this.autoPlayTimer = null
    }

    this.phaseValue = 0
    this.uPhase.value = 0
    this.lastTime = performance.now()

    if (this.animationId === null) {
      this.animationId = requestAnimationFrame(this.tick)
    }
  }

  /** Advance the timeline manually, used by the internal animation loop */
  update(deltaSeconds: number): void {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return

    this.phaseValue = Math.min(this.phaseValue + deltaSeconds, DURATION)
    this.uPhase.value = this.phaseValue
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    if (this.autoPlayTimer !== null) {
      clearTimeout(this.autoPlayTimer)
      this.autoPlayTimer = null
    }

    this.removeEventListener('added', this.handleAdded)
    this.geometry.dispose()
    this.pointsMaterial.dispose()
    this.trailMaterial.dispose()
    this.removeFromParent()
    this.clear()
  }

  private handleAdded = (): void => {
    const renderer = this.parent?.userData?.renderer as RendererInfo | undefined
    this.isWebGPU = renderer?.isWebGPURenderer === true
    this.uPixelRatio.value = renderer?.getPixelRatio?.() ?? 1
    this.updateVertexColors()
  }

  private tick = (): void => {
    this.animationId = null
    if (this.disposed) return

    const now = performance.now()
    const delta = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    this.update(delta)

    if (!this.disposed && this.phaseValue < DURATION) {
      this.animationId = requestAnimationFrame(this.tick)
    }
  }

  private resetTimeline(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    this.phaseValue = 0
    this.uPhase.value = 0
  }

  private rebuildGeometry(): void {
    const geometry = this.createGeometry()
    const previous = this.geometry

    this.points.geometry = geometry
    this.trail.geometry = geometry
    this.geometry = geometry
    previous.dispose()
    this.updateVertexColors()
  }

  private createGeometry(): THREE.BufferGeometry {
    const sample = sampleTextParticles(this.currentText, {
      worldScale: this.worldScale,
      offsetY: this.offsetY
    })

    const count = sample.count
    const vertexCount = count * 4
    const groupCount = this.colors.length
    const random = createRandom(this.seed)

    const positions = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const origins = new Float32Array(vertexCount * 3)
    const centerAttributes = new Float32Array(vertexCount * 3)
    const bursts = new Float32Array(vertexCount * 2)
    const delays = new Float32Array(vertexCount)
    const colorAttributes = new Float32Array(vertexCount * 3)
    const sizes = new Float32Array(vertexCount)
    const indices = new Uint32Array(count * 6)
    const baseColors = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const originX = sample.positions[i * 3]
      const originY = sample.positions[i * 3 + 1]

      // Group particles by their horizontal position inside the glyph so each
      // part of the sentence flies to its own burst centre.
      const ratio =
        sample.worldScale > 0
          ? (originX / sample.worldScale + sample.canvasWidth / 2) / sample.canvasWidth
          : 0.5
      const group = Math.min(groupCount - 1, Math.max(0, Math.floor(ratio * groupCount)))
      const center = this.centers[group]
      const color = this.colors[group]

      const angle = random() * Math.PI * 2
      const shell = random() < 0.77 ? 1.32 + random() * 0.27 : 0.52 + random() * 0.64
      const burstX = Math.cos(angle) * shell
      const burstY = Math.sin(angle) * shell
      const delay = group * this.groupDelay + random() * this.groupJitter
      const colorScale = 0.86 + random() * 0.28
      const size = 0.7 + random() * 0.65
      const centerX = center[0] + (random() - 0.5) * 0.16
      const centerY = center[1] + (random() - 0.5) * 0.16

      baseColors[i * 3] = color.r * colorScale
      baseColors[i * 3 + 1] = color.g * colorScale
      baseColors[i * 3 + 2] = color.b * colorScale

      for (let corner = 0; corner < 4; corner += 1) {
        const vertex = i * 4 + corner

        positions[vertex * 3] = QUAD_CORNERS[corner][0]
        positions[vertex * 3 + 1] = QUAD_CORNERS[corner][1]
        positions[vertex * 3 + 2] = 0

        uvs[vertex * 2] = QUAD_UVS[corner][0]
        uvs[vertex * 2 + 1] = QUAD_UVS[corner][1]

        origins[vertex * 3] = originX
        origins[vertex * 3 + 1] = originY
        origins[vertex * 3 + 2] = 0

        centerAttributes[vertex * 3] = centerX
        centerAttributes[vertex * 3 + 1] = centerY
        centerAttributes[vertex * 3 + 2] = 0

        bursts[vertex * 2] = burstX
        bursts[vertex * 2 + 1] = burstY

        delays[vertex] = delay
        colorAttributes[vertex * 3] = baseColors[i * 3]
        colorAttributes[vertex * 3 + 1] = baseColors[i * 3 + 1]
        colorAttributes[vertex * 3 + 2] = baseColors[i * 3 + 2]
        sizes[vertex] = size
      }

      const index = i * 6
      const base = i * 4
      indices[index] = base
      indices[index + 1] = base + 1
      indices[index + 2] = base + 2
      indices[index + 3] = base + 1
      indices[index + 4] = base + 3
      indices[index + 5] = base + 2
    }

    this.particleCountValue = count
    this.baseColors = baseColors

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 3))
    geometry.setAttribute('aCenter', new THREE.BufferAttribute(centerAttributes, 3))
    geometry.setAttribute('aBurst', new THREE.BufferAttribute(bursts, 2))
    geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorAttributes, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))

    return geometry
  }

  private updateVertexColors(): void {
    const attribute = this.geometry.getAttribute('aColor') as THREE.BufferAttribute | undefined
    const array = attribute?.array as Float32Array | undefined

    if (attribute && array) {
      for (let i = 0; i < this.baseColors.length; i += 1) {
        array[i] = this.isWebGPU ? Math.pow(this.baseColors[i], 2.2) * 0.86 : this.baseColors[i]
      }
      attribute.needsUpdate = true
    }

    const restColor = this.uRestColor.value
    restColor.copy(this.baseRestColor)

    if (this.isWebGPU) {
      restColor.setRGB(
        Math.pow(this.baseRestColor.r, 2.2) * 0.86,
        Math.pow(this.baseRestColor.g, 2.2) * 0.86,
        Math.pow(this.baseRestColor.b, 2.2) * 0.86
      )
    }
  }

  private createLayerMaterial(pointSize: number, trailOffset: number, opacity: number): NodeMaterial {
    const material = new NodeMaterial()
    const vColor = varying(vec3(0))
    const vAlpha = varying(float(0))

    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.alphaTest = 0.01

    material.vertexNode = Fn(() => {
      const origin = attribute<'vec3'>('aOrigin', 'vec3')
      const centerAttribute = attribute<'vec3'>('aCenter', 'vec3')
      const burst = attribute<'vec2'>('aBurst', 'vec2')
      const delay = attribute<'float'>('aDelay', 'float')
      const color = attribute<'vec3'>('aColor', 'vec3')
      const size = attribute<'float'>('aSize', 'float')

      const phase = this.uPhase.sub(trailOffset)
      const local = phase.sub(delay)
      const lift = smoothstep(0, LIFT_END, local)
      const center = vec3(
        centerAttribute.x.mul(this.uBurstScale),
        centerAttribute.y.mul(this.uBurstScale),
        0
      )
      const pos = mix(origin, center, lift).toVar()

      // Bend the flight path sideways so particles look like they are being
      // pulled out of the glyph instead of sliding in a straight line.
      const liftProgress = clamp(local.div(LIFT_END), 0, 1)
      const arc = sin(liftProgress.mul(Math.PI)).mul(0.16)
      pos.addAssign(vec3(burst.x.mul(arc), burst.y.mul(arc), 0))

      const burstTime = max(local.sub(LIFT_END), 0)
      const spread = float(1).sub(exp(burstTime.mul(-2.7)))
      pos.addAssign(
        vec3(
          burst.x.mul(spread).mul(this.uBurstScale),
          burst.y.mul(spread).mul(this.uBurstScale).sub(burstTime.mul(burstTime).mul(0.18)),
          0
        )
      )

      const returnProgress = smoothstep(RETURN_START, RETURN_END, phase)
      pos.assign(mix(pos, origin, returnProgress))

      vColor.assign(
        mix(
          this.uRestColor,
          color,
          smoothstep(0.15, 1, local).mul(float(1).sub(returnProgress))
        )
      )

      const sizeBoost = float(1).add(spread.mul(0.55))
      const centerView = modelViewMatrix.mul(vec4(pos, 1))
      const viewDepth = max(centerView.z.negate(), 0.1)
      const attenuation = min(float(9).div(viewDepth), 1)
      const pixelSize = max(
        float(pointSize).mul(size).mul(sizeBoost).mul(attenuation).mul(this.uPixelRatio),
        1.2
      )

      const centerClip = cameraProjectionMatrix.mul(centerView)
      const offsetX = positionLocal.x.mul(pixelSize.div(viewportSize.x.mul(0.5))).mul(centerClip.w)
      const offsetY = positionLocal.y.mul(pixelSize.div(viewportSize.y.mul(0.5))).mul(centerClip.w)

      vAlpha.assign(opacity)

      return vec4(centerClip.x.add(offsetX), centerClip.y.add(offsetY), centerClip.z, centerClip.w)
    })()

    material.fragmentNode = Fn(() => {
      const p = uv().sub(vec2(0.5, 0.5))
      const radius = length(p)
      const core = float(1).sub(smoothstep(0.04, 0.24, radius))
      const glow = exp(radius.mul(radius).mul(-15)).mul(0.38)

      return vec4(vColor, core.mul(0.72).add(glow).mul(vAlpha))
    })()

    return material
  }
}
