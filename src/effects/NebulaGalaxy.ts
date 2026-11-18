import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  atan,
  cameraProjectionMatrix,
  cos,
  exp,
  float,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  positionLocal,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec3,
  vec4,
  viewportSize
} from 'three/tsl'

/** Built-in galaxy colour schemes, from warm core to cool rim */
export type GalaxyPalette = 'violet-gold' | 'aurora' | 'warm-flame'

export interface NebulaGalaxyOptions {
  /** Number of spiral arms, default: 4 */
  arms?: number
  /** Stars that trace the spiral arms, default: 26000 */
  armStars?: number
  /** Stars that fill the core, default: 4800 */
  coreStars?: number
  /** Large, faint stars that soften the edges, default: 4400 */
  dustStars?: number
  /** Distant background stars outside the galaxy body, default: 780 */
  backgroundStars?: number
  /** Galaxy radius in world units, default: 5.15 */
  radius?: number
  /** How tightly the arms wind with distance, default: 1.12 */
  armTightness?: number
  /** Colour scheme, default: 'violet-gold' */
  palette?: GalaxyPalette
  /** Spin speed multiplier, default: 1 */
  speed?: number
  /** Slowly turn the galaxy when idle, default: true unless reduced motion */
  autoRotate?: boolean
  /** Enable drag / wheel / pinch interaction on the canvas, default: true */
  interaction?: boolean
  /** Click / tap wave, default: true unless reduced motion */
  pulse?: boolean
  /** Opacity of the haze layer, default: 0.95 */
  hazeOpacity?: number
  /** Smoothing speed of tilt, zoom and palette transitions, default: 5.8 */
  followSpeed?: number
  /** Maximum vertical tilt in radians, default: 1.15 */
  maxTiltX?: number
  /** Maximum horizontal tilt in radians, default: 1.25 */
  maxTiltY?: number
  /** Smallest zoom factor, default: 0.62 */
  minZoom?: number
  /** Largest zoom factor, default: 1.55 */
  maxZoom?: number
  /** Seed for the deterministic star distribution, default: 7 */
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
  domElement?: HTMLCanvasElement
}

interface StarData {
  x: number
  y: number
  z: number
  size: number
  mix: number
  opacity: number
  seed: number
}

interface PaletteColors {
  core: THREE.ColorRepresentation
  arm: THREE.ColorRepresentation
  edge: THREE.ColorRepresentation
}

const PALETTES: Record<GalaxyPalette, PaletteColors> = {
  'violet-gold': { core: 0xffe0a8, arm: 0xb07cff, edge: 0x4a7dff },
  aurora: { core: 0xd6fff2, arm: 0x35e0a8, edge: 0x4f8bff },
  'warm-flame': { core: 0xfff0c0, arm: 0xff9448, edge: 0xff4d6d }
}

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

const PULSE_SPEED = 3.3
const PULSE_LIFETIME = 2.6
const AUTO_ROTATE_SPEED = 0.075
const DRAG_TILT_X = 0.004
const DRAG_TILT_Y = 0.005
const WHEEL_ZOOM = 0.0012
const CLICK_TRAVEL = 6

function clampNumber(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function findScene(object: THREE.Object3D): THREE.Scene | null {
  let node: THREE.Object3D | null = object
  while (node) {
    if ((node as THREE.Scene).isScene) return node as THREE.Scene
    node = node.parent
  }
  return null
}

function createArmStars(
  count: number,
  radius: number,
  arms: number,
  tightness: number,
  random: () => number
): StarData[] {
  const stars: StarData[] = []

  for (let i = 0; i < count; i += 1) {
    const arm = i % arms
    const distance = Math.pow(random(), 0.78) * radius
    const spread = (random() - 0.5) * (0.28 + distance * 0.16)
    const angle = (arm * Math.PI * 2) / arms + distance * tightness + spread

    // Scatter each star slightly along the arm normal so the spiral reads as a
    // band instead of a one-pixel-wide curve.
    const normalOffset = (random() - 0.5) * 0.12
    const normalX = -Math.sin(angle)
    const normalY = Math.cos(angle)

    // The disc is thicker near the core and thins out towards the rim.
    const thickness = Math.max(0.05, 0.55 - distance * 0.06)

    stars.push({
      x: Math.cos(angle) * distance + normalX * normalOffset,
      y: Math.sin(angle) * distance + normalY * normalOffset,
      z: (random() - 0.5) * thickness,
      size: 0.72 + random() * 0.6,
      mix: Math.min(1, (distance / radius) * (0.78 + random() * 0.22) + 0.02),
      opacity: 0.72 + random() * 0.28,
      seed: random()
    })
  }

  return stars
}

function createCoreStars(count: number, radius: number, random: () => number): StarData[] {
  const stars: StarData[] = []

  for (let i = 0; i < count; i += 1) {
    const distance = Math.pow(random(), 1.7) * radius * 0.34
    const angle = random() * Math.PI * 2

    stars.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      z: (random() - 0.5) * Math.max(0.08, 0.34 - distance * 0.12),
      size: 0.8 + random() * 0.8,
      mix: random() * 0.12,
      opacity: 0.75 + random() * 0.25,
      seed: random()
    })
  }

  return stars
}

function createDustStars(count: number, radius: number, random: () => number): StarData[] {
  const stars: StarData[] = []

  for (let i = 0; i < count; i += 1) {
    const distance = Math.pow(random(), 0.72) * radius * 1.03
    const angle = random() * Math.PI * 2

    stars.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      z: (random() - 0.5) * 0.42,
      size: 1.9 + random() * 1.1,
      mix: 0.35 + random() * 0.65,
      opacity: 0.12 + random() * 0.18,
      seed: random()
    })
  }

  return stars
}

function createBackgroundStars(count: number, random: () => number): StarData[] {
  const stars: StarData[] = []

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2
    const distance = 6 + Math.sqrt(random()) * 30

    stars.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      z: -18 - random() * 30,
      size: 0.45 + random() * 0.55,
      mix: 0.45 + random() * 0.55,
      opacity: 0.22 + random() * 0.4,
      seed: random()
    })
  }

  return stars
}

function buildStarGeometry(stars: StarData[]): THREE.BufferGeometry {
  const count = stars.length
  const vertexCount = count * 4

  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const centers = new Float32Array(vertexCount * 3)
  const sizes = new Float32Array(vertexCount)
  const mixes = new Float32Array(vertexCount)
  const opacities = new Float32Array(vertexCount)
  const seeds = new Float32Array(vertexCount)
  const indices = new Uint32Array(count * 6)

  for (let i = 0; i < count; i += 1) {
    const star = stars[i]

    for (let corner = 0; corner < 4; corner += 1) {
      const vertex = i * 4 + corner

      positions[vertex * 3] = QUAD_CORNERS[corner][0]
      positions[vertex * 3 + 1] = QUAD_CORNERS[corner][1]
      positions[vertex * 3 + 2] = 0

      uvs[vertex * 2] = QUAD_UVS[corner][0]
      uvs[vertex * 2 + 1] = QUAD_UVS[corner][1]

      centers[vertex * 3] = star.x
      centers[vertex * 3 + 1] = star.y
      centers[vertex * 3 + 2] = star.z

      sizes[vertex] = star.size
      mixes[vertex] = star.mix
      opacities[vertex] = star.opacity
      seeds[vertex] = star.seed
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

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1))
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  return geometry
}

/**
 * A four-armed spiral galaxy made of additive billboard particles, a procedural
 * haze plane and an expanding click wave. Everything animates from the internal
 * frame loop: drag to tilt the disc, wheel or pinch to zoom, click to send a
 * light wave from the core along the arms.
 */
export default class NebulaGalaxy extends THREE.Group {
  /** Rotating part of the galaxy, the group the pointer tilts and zooms */
  readonly galaxy = new THREE.Group()
  /** Spiral arms, core and dust particles */
  readonly stars: THREE.Mesh
  /** Distant stars that stay fixed while the galaxy turns */
  readonly background: THREE.Mesh
  /** Procedural haze that softens the particle pattern */
  readonly haze: THREE.Mesh
  /** Expanding ring that follows a click or tap */
  readonly ring: THREE.Mesh

  private readonly armGeometry: THREE.BufferGeometry
  private readonly backgroundGeometry: THREE.BufferGeometry
  private readonly hazeGeometry: THREE.BufferGeometry
  private readonly ringGeometry: THREE.BufferGeometry
  private readonly starMaterial: NodeMaterial
  private readonly backgroundMaterial: NodeMaterial
  private readonly hazeMaterial: NodeMaterial
  private readonly ringMaterial: NodeMaterial

  private readonly uTime: ScalarUniformNode
  private readonly uPulse: ScalarUniformNode
  private readonly uPixelRatio: ScalarUniformNode
  private readonly uCoreColor: ColorUniformNode
  private readonly uArmColor: ColorUniformNode
  private readonly uEdgeColor: ColorUniformNode

  private readonly coreColor: THREE.Color
  private readonly armColor: THREE.Color
  private readonly edgeColor: THREE.Color
  private readonly targetCoreColor: THREE.Color
  private readonly targetArmColor: THREE.Color
  private readonly targetEdgeColor: THREE.Color

  private readonly followSpeed: number
  private readonly maxTiltX: number
  private readonly maxTiltY: number
  private readonly minZoom: number
  private readonly maxZoom: number
  private readonly pulseEnabled: boolean
  private readonly interactionEnabled: boolean
  private readonly radius: number

  private particleTotal = 0
  private backgroundTotal = 0

  private currentPalette: GalaxyPalette
  private currentSpeed: number
  private pausedValue = false
  private autoRotateValue: boolean

  private timeValue = 0
  private pulseAgeValue = 99
  private tiltXValue = 0
  private tiltYValue = 0
  private targetTiltX = 0
  private targetTiltY = 0
  private zoomValue = 1
  private targetZoom = 1

  private animationId: number | null = null
  private lastTime = 0
  private isWebGPU = false
  private disposed = false

  private canvas: HTMLCanvasElement | null = null
  private previousTouchAction = ''
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private dragging = false
  private pinching = false
  private travel = 0
  private lastPointer = { x: 0, y: 0 }
  private pinchStartDistance = 0
  private pinchStartZoom = 1

  constructor(options: NebulaGalaxyOptions = {}) {
    super()

    this.name = 'NebulaGalaxy'
    this.radius = options.radius ?? 5.15
    this.followSpeed = Math.max(0.0001, options.followSpeed ?? 5.8)
    this.maxTiltX = options.maxTiltX ?? 1.15
    this.maxTiltY = options.maxTiltY ?? 1.25
    this.minZoom = options.minZoom ?? 0.62
    this.maxZoom = options.maxZoom ?? 1.55
    this.interactionEnabled = options.interaction ?? true
    this.pulseEnabled = options.pulse ?? !prefersReducedMotion()
    this.autoRotateValue = options.autoRotate ?? !prefersReducedMotion()
    this.currentPalette = options.palette ?? 'violet-gold'
    this.currentSpeed = Math.max(0, options.speed ?? 1)

    const palette = PALETTES[this.currentPalette]
    this.coreColor = new THREE.Color(palette.core)
    this.armColor = new THREE.Color(palette.arm)
    this.edgeColor = new THREE.Color(palette.edge)
    this.targetCoreColor = this.coreColor.clone()
    this.targetArmColor = this.armColor.clone()
    this.targetEdgeColor = this.edgeColor.clone()

    this.uTime = createScalarUniform(0)
    this.uPulse = createScalarUniform(this.pulseAgeValue)
    this.uPixelRatio = createScalarUniform(1)
    this.uCoreColor = createColorUniform(this.coreColor.clone())
    this.uArmColor = createColorUniform(this.armColor.clone())
    this.uEdgeColor = createColorUniform(this.edgeColor.clone())

    const random = createRandom(options.seed ?? 7)
    const arms = Math.max(1, Math.round(options.arms ?? 4))
    const armStars = Math.max(0, Math.round(options.armStars ?? 26000))
    const coreStars = Math.max(0, Math.round(options.coreStars ?? 4800))
    const dustStars = Math.max(0, Math.round(options.dustStars ?? 4400))
    const backgroundStars = Math.max(0, Math.round(options.backgroundStars ?? 780))
    const tightness = options.armTightness ?? 1.12

    const mainStars = [
      ...createArmStars(armStars, this.radius, arms, tightness, random),
      ...createCoreStars(coreStars, this.radius, random),
      ...createDustStars(dustStars, this.radius, random)
    ]
    this.particleTotal = mainStars.length
    this.backgroundTotal = backgroundStars

    this.armGeometry = buildStarGeometry(mainStars)
    this.backgroundGeometry = buildStarGeometry(
      createBackgroundStars(backgroundStars, random)
    )

    this.starMaterial = this.createStarMaterial({
      pointSize: 2.6,
      spin: 1,
      brightness: 1
    })
    this.backgroundMaterial = this.createStarMaterial({
      pointSize: 2.2,
      spin: 0,
      brightness: 0.9
    })

    this.stars = new THREE.Mesh(this.armGeometry, this.starMaterial)
    this.stars.name = 'NebulaGalaxyStars'
    this.stars.frustumCulled = false
    this.stars.renderOrder = 3

    this.background = new THREE.Mesh(this.backgroundGeometry, this.backgroundMaterial)
    this.background.name = 'NebulaGalaxyBackground'
    this.background.frustumCulled = false
    this.background.renderOrder = 0

    const hazeScale = this.radius * 1.4
    this.hazeGeometry = new THREE.PlaneGeometry(2, 2)
    this.hazeMaterial = this.createHazeMaterial(options.hazeOpacity ?? 0.95)
    this.haze = new THREE.Mesh(this.hazeGeometry, this.hazeMaterial)
    this.haze.name = 'NebulaGalaxyHaze'
    this.haze.scale.setScalar(hazeScale)
    this.haze.position.z = -0.2
    this.haze.frustumCulled = false
    this.haze.renderOrder = 1

    this.ringGeometry = new THREE.PlaneGeometry(2, 2)
    this.ringMaterial = this.createRingMaterial(PULSE_SPEED / hazeScale)
    this.ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial)
    this.ring.name = 'NebulaGalaxyRing'
    this.ring.scale.setScalar(hazeScale)
    this.ring.position.z = -0.35
    this.ring.frustumCulled = false
    this.ring.renderOrder = 2

    this.galaxy.add(this.stars, this.haze, this.ring)
    this.add(this.galaxy, this.background)

    this.addEventListener('added', this.handleAdded)
    this.addEventListener('removed', this.handleRemoved)
  }

  /** Colour scheme currently being blended towards */
  get palette(): GalaxyPalette {
    return this.currentPalette
  }

  /** Number of stars that make up the galaxy body */
  get particleCount(): number {
    return this.particleTotal
  }

  /** Number of distant background stars */
  get backgroundCount(): number {
    return this.backgroundTotal
  }

  /** Current spin speed multiplier */
  get speed(): number {
    return this.currentSpeed
  }

  /** Whether the spin is frozen */
  get paused(): boolean {
    return this.pausedValue
  }

  /** Accumulated shader time in seconds */
  get time(): number {
    return this.timeValue
  }

  /** Seconds since the last click wave started */
  get pulseAge(): number {
    return this.pulseAgeValue
  }

  /** Current tilt applied to the disc in radians */
  get tilt(): { x: number; y: number } {
    return { x: this.tiltXValue, y: this.tiltYValue }
  }

  /** Current zoom factor applied to the disc */
  get zoom(): number {
    return this.zoomValue
  }

  /** Blend towards another built-in palette */
  setPalette(palette: GalaxyPalette): void {
    if (this.disposed || palette === this.currentPalette) return

    const colors = PALETTES[palette]
    this.currentPalette = palette
    this.targetCoreColor.set(colors.core)
    this.targetArmColor.set(colors.arm)
    this.targetEdgeColor.set(colors.edge)
  }

  /** Set the spin speed multiplier, 0 freezes the shader time */
  setSpeed(speed: number): void {
    if (this.disposed) return
    this.currentSpeed = Math.max(0, speed)
  }

  /** Freeze or resume the spin and the idle rotation */
  setPaused(paused: boolean): void {
    if (this.disposed) return
    this.pausedValue = paused
  }

  /** Enable or disable the idle rotation */
  setAutoRotate(enabled: boolean): void {
    if (this.disposed) return
    this.autoRotateValue = enabled
  }

  /** Send a light wave from the core along the arms */
  pulse(): void {
    if (this.disposed) return
    this.pulseAgeValue = 0
    this.uPulse.value = 0
  }

  /** Advance the effect manually, the internal loop calls this per frame */
  update(deltaSeconds: number): void {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return

    const delta = deltaSeconds
    const follow = 1 - Math.exp(-this.followSpeed * delta)

    if (!this.pausedValue) {
      this.timeValue += delta * this.currentSpeed

      if (this.autoRotateValue && !this.dragging) {
        this.targetTiltY = clampNumber(
          this.targetTiltY + AUTO_ROTATE_SPEED * delta,
          -this.maxTiltY,
          this.maxTiltY
        )
      }
    }

    this.tiltXValue += (this.targetTiltX - this.tiltXValue) * follow
    this.tiltYValue += (this.targetTiltY - this.tiltYValue) * follow
    this.zoomValue += (this.targetZoom - this.zoomValue) * follow

    this.galaxy.rotation.x = this.tiltXValue
    this.galaxy.rotation.y = this.tiltYValue
    this.galaxy.scale.setScalar(this.zoomValue)

    if (this.pulseAgeValue < PULSE_LIFETIME) {
      this.pulseAgeValue = Math.min(this.pulseAgeValue + delta, PULSE_LIFETIME)
    }

    this.uTime.value = this.timeValue
    this.uPulse.value = this.pulseAgeValue

    this.coreColor.lerp(this.targetCoreColor, follow)
    this.armColor.lerp(this.targetArmColor, follow)
    this.edgeColor.lerp(this.targetEdgeColor, follow)
    this.writeUniformColors()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.stopLoop()
    this.detachInput()
    this.removeEventListener('added', this.handleAdded)
    this.removeEventListener('removed', this.handleRemoved)

    this.armGeometry.dispose()
    this.backgroundGeometry.dispose()
    this.hazeGeometry.dispose()
    this.ringGeometry.dispose()
    this.starMaterial.dispose()
    this.backgroundMaterial.dispose()
    this.hazeMaterial.dispose()
    this.ringMaterial.dispose()

    this.removeFromParent()
    this.clear()
  }

  private handleAdded = (): void => {
    const renderer = findScene(this)?.userData?.renderer as RendererInfo | undefined

    this.isWebGPU = renderer?.isWebGPURenderer === true
    this.uPixelRatio.value = renderer?.getPixelRatio?.() ?? 1
    this.writeUniformColors()

    this.attachInput(renderer?.domElement)
    this.startLoop()
  }

  private handleRemoved = (): void => {
    this.stopLoop()
    this.detachInput()
  }

  private startLoop(): void {
    if (this.disposed || this.animationId !== null) return

    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame(this.tick)
  }

  private stopLoop(): void {
    if (this.animationId === null) return

    cancelAnimationFrame(this.animationId)
    this.animationId = null
  }

  private tick = (): void => {
    this.animationId = null
    if (this.disposed) return

    const now = performance.now()
    const delta = this.lastTime > 0 ? Math.min((now - this.lastTime) / 1000, 0.1) : 1 / 60
    this.lastTime = now
    this.update(delta)

    if (!this.disposed && this.parent) {
      this.animationId = requestAnimationFrame(this.tick)
    }
  }

  private attachInput(canvas: HTMLCanvasElement | undefined): void {
    if (!canvas || !this.interactionEnabled || typeof window === 'undefined') return
    if (this.canvas === canvas) return

    this.detachInput()

    this.canvas = canvas
    this.previousTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'

    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerCancel)
  }

  private detachInput(): void {
    const canvas = this.canvas
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('wheel', this.handleWheel)
      canvas.style.touchAction = this.previousTouchAction
      this.canvas = null
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.handlePointerMove)
      window.removeEventListener('pointerup', this.handlePointerUp)
      window.removeEventListener('pointercancel', this.handlePointerCancel)
    }

    this.pointers.clear()
    this.dragging = false
    this.pinching = false
  }

  private pointerDistance(): number {
    const points = [...this.pointers.values()]
    if (points.length < 2) return 0

    const dx = points[0].x - points[1].x
    const dy = points[0].y - points[1].y
    return Math.hypot(dx, dy)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed || !this.interactionEnabled) return

    const id = typeof event.pointerId === 'number' ? event.pointerId : 0
    this.pointers.set(id, { x: event.clientX, y: event.clientY })

    if (this.pointers.size === 1) {
      this.dragging = true
      this.pinching = false
      this.travel = 0
      this.lastPointer = { x: event.clientX, y: event.clientY }
    } else if (this.pointers.size === 2) {
      this.pinching = true
      this.pinchStartDistance = this.pointerDistance()
      this.pinchStartZoom = this.targetZoom
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || !this.interactionEnabled) return

    const id = typeof event.pointerId === 'number' ? event.pointerId : 0
    if (!this.pointers.has(id)) return

    this.pointers.set(id, { x: event.clientX, y: event.clientY })

    if (this.pointers.size >= 2) {
      const distance = this.pointerDistance()
      if (distance > 0 && this.pinchStartDistance > 0) {
        const factor = this.pinchStartDistance / distance
        this.targetZoom = clampNumber(this.pinchStartZoom * factor, this.minZoom, this.maxZoom)
      }
      return
    }

    if (!this.dragging) return

    const deltaX = event.clientX - this.lastPointer.x
    const deltaY = event.clientY - this.lastPointer.y
    this.lastPointer = { x: event.clientX, y: event.clientY }
    this.travel += Math.abs(deltaX) + Math.abs(deltaY)

    this.targetTiltY = clampNumber(
      this.targetTiltY + deltaX * DRAG_TILT_Y,
      -this.maxTiltY,
      this.maxTiltY
    )
    this.targetTiltX = clampNumber(
      this.targetTiltX + deltaY * DRAG_TILT_X,
      -this.maxTiltX,
      this.maxTiltX
    )
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.disposed || !this.interactionEnabled) return

    const id = typeof event.pointerId === 'number' ? event.pointerId : 0
    if (!this.pointers.has(id)) return

    this.pointers.delete(id)

    if (this.pointers.size === 0) {
      const isClick = this.dragging && !this.pinching && this.travel < CLICK_TRAVEL
      this.dragging = false
      this.pinching = false

      if (isClick && this.pulseEnabled) this.pulse()
    }
  }

  private handlePointerCancel = (event: PointerEvent): void => {
    if (this.disposed || !this.interactionEnabled) return

    const id = typeof event.pointerId === 'number' ? event.pointerId : 0
    this.pointers.delete(id)

    if (this.pointers.size === 0) {
      this.dragging = false
      this.pinching = false
    }
  }

  private handleWheel = (event: WheelEvent): void => {
    if (this.disposed || !this.interactionEnabled) return

    event.preventDefault()
    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM)
    this.targetZoom = clampNumber(this.targetZoom * factor, this.minZoom, this.maxZoom)
  }

  private writeUniformColors(): void {
    this.writeColor(this.uCoreColor.value, this.coreColor)
    this.writeColor(this.uArmColor.value, this.armColor)
    this.writeColor(this.uEdgeColor.value, this.edgeColor)
  }

  private writeColor(target: THREE.Color, color: THREE.Color): void {
    if (this.isWebGPU) {
      target.setRGB(
        Math.pow(color.r, 2.2) * 0.86,
        Math.pow(color.g, 2.2) * 0.86,
        Math.pow(color.b, 2.2) * 0.86
      )
    } else {
      target.copy(color)
    }
  }

  private createStarMaterial(options: {
    pointSize: number
    spin: number
    brightness: number
  }): NodeMaterial {
    const material = new NodeMaterial()
    const vColor = varying(vec3(0))
    const vAlpha = varying(float(0))
    const { pointSize, spin, brightness } = options

    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.fog = false

    material.vertexNode = Fn(() => {
      const center = attribute<'vec3'>('aCenter', 'vec3')
      const size = attribute<'float'>('aSize', 'float')
      const mixValue = attribute<'float'>('aMix', 'float')
      const alpha = attribute<'float'>('aOpacity', 'float')
      const seed = attribute<'float'>('aSeed', 'float')

      const radius = length(center.xy)
      const spinAngle = this.uTime
        .mul(float(0.022).add(float(0.15).div(radius.add(0.45))))
        .mul(spin)
      const spinCos = cos(spinAngle)
      const spinSin = sin(spinAngle)

      const spun = vec3(
        center.x.mul(spinCos).sub(center.y.mul(spinSin)),
        center.x.mul(spinSin).add(center.y.mul(spinCos)),
        center.z
      )

      // A wave travels outwards after a click: it lifts the disc, pushes stars
      // apart and brightens them as it passes.
      const front = this.uPulse.mul(PULSE_SPEED)
      const waveDelta = radius.sub(front).mul(2.3)
      const wave = exp(waveDelta.mul(waveDelta).mul(-1)).mul(exp(this.uPulse.mul(-0.23)))

      const pos = vec3(
        spun.x.mul(float(1).add(wave.mul(0.075))),
        spun.y.mul(float(1).add(wave.mul(0.075))),
        spun.z.add(wave.mul(0.48))
      )

      const coreWeight = smoothstep(0, 0.5, mixValue)
      const edgeWeight = smoothstep(0.55, 1, mixValue)
      const color = mix(
        mix(this.uCoreColor, this.uArmColor, coreWeight),
        this.uEdgeColor,
        edgeWeight
      )

      vColor.assign(
        color.mul(float(0.82).add(seed.mul(0.42)).add(wave.mul(0.65))).mul(brightness)
      )
      vAlpha.assign(alpha)

      const centerView = modelViewMatrix.mul(vec4(pos, 1))
      const viewDepth = max(centerView.z.negate(), 0.1)
      const attenuation = min(float(9).div(viewDepth), 1)
      const pixelSize = max(
        float(pointSize).mul(size).mul(attenuation).mul(this.uPixelRatio),
        1
      )

      const centerClip = cameraProjectionMatrix.mul(centerView)
      const offsetX = positionLocal.x.mul(pixelSize.div(viewportSize.x.mul(0.5))).mul(centerClip.w)
      const offsetY = positionLocal.y.mul(pixelSize.div(viewportSize.y.mul(0.5))).mul(centerClip.w)

      return vec4(centerClip.x.add(offsetX), centerClip.y.add(offsetY), centerClip.z, centerClip.w)
    })()

    material.fragmentNode = Fn(() => {
      const p = uv().sub(0.5)
      const radius = length(p).mul(2)
      const core = float(1).sub(smoothstep(0.05, 0.28, radius))
      const glow = exp(radius.mul(radius).mul(-4)).mul(0.3)

      return vec4(vColor, core.mul(0.72).add(glow).mul(vAlpha))
    })()

    return material
  }

  private createHazeMaterial(opacity: number): NodeMaterial {
    const material = new NodeMaterial()
    const uHazeOpacity = createScalarUniform(clampNumber(opacity, 0, 1))

    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.side = THREE.DoubleSide
    material.fog = false

    material.fragmentNode = Fn(() => {
      const p = uv().mul(2).sub(1)
      const radius = length(p)

      // The haze follows the arms but lags behind the particles, which keeps
      // the pattern from looking like a rigid texture.
      const angle = atan(p.y, p.x).sub(radius.mul(5.4)).sub(this.uTime.mul(0.025))
      const arms = pow(float(0.5).add(cos(angle.mul(4)).mul(0.5)), 5)
      const falloff = exp(radius.mul(radius).mul(-5))
      const ripple = sin(radius.mul(34).add(angle.mul(2))).mul(0.05).add(0.95)
      const haze = falloff.mul(float(0.12).add(arms.mul(0.55))).mul(ripple)
      const core = exp(radius.mul(radius).mul(-26)).mul(0.35)

      const color = mix(
        mix(this.uCoreColor, this.uArmColor, smoothstep(0, 0.55, radius)),
        this.uEdgeColor,
        smoothstep(0.6, 1, radius)
      )

      return vec4(color, haze.add(core).mul(uHazeOpacity))
    })()

    return material
  }

  private createRingMaterial(frontSpeed: number): NodeMaterial {
    const material = new NodeMaterial()
    const uRingFrontSpeed = createScalarUniform(frontSpeed)

    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.side = THREE.DoubleSide
    material.fog = false

    material.fragmentNode = Fn(() => {
      const p = uv().mul(2).sub(1)
      const radius = length(p)
      const front = this.uPulse.mul(uRingFrontSpeed)
      const distance = radius.sub(front)
      const ring = exp(distance.mul(distance).mul(-420))
      const fade = max(float(1).sub(this.uPulse.div(PULSE_LIFETIME)), 0)

      const color = mix(this.uCoreColor, this.uArmColor, 0.6)

      return vec4(color, ring.mul(fade.mul(fade)).mul(0.9))
    })()

    return material
  }
}
