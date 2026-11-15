import * as THREE from 'three'
import { PointsNodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  cos,
  float,
  length,
  mod,
  oneMinus,
  positionGeometry,
  modelViewMatrix,
  pointUV,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4
} from 'three/tsl'

export interface SnowEffectOptions {
  /** Number of flakes, default: 1500 */
  count?: number
  /** Fall speed in world units per second, default: 2 */
  speed?: number
  /** Horizontal half-extent of the snow volume, default: 40 */
  range?: number
  /** Vertical extent of the snow volume, default: 30 */
  height?: number
  /** Flake size, default: 8 */
  size?: number
  /** Sway amplitude in world units, default: 0.6 */
  turbulence?: number
  /** Flake color, default: 0xffffff */
  color?: number
  /** Flake opacity, default: 0.9 */
  opacity?: number
  /** Horizontal wind drift in world units per second, default: [0.5, 0] */
  wind?: [number, number]
}

/**
 * Lightweight snowfall built from a single `THREE.Points` cloud. Flakes fall,
 * drift with wind and sway on individual phases, wrapping inside a box volume.
 *
 * Built entirely with TSL, so it renders on both `WebGPURenderer` and a classic
 * `WebGLRenderer` (through three's `WebGLNodesHandler`).
 */
export default class SnowEffect {
  readonly mesh: THREE.Points<THREE.BufferGeometry, PointsNodeMaterial>

  private time = 0
  private uTime = uniform(0)

  constructor(options: SnowEffectOptions = {}) {
    const {
      count = 1500,
      speed = 2,
      range = 40,
      height = 30,
      size = 8,
      turbulence = 0.6,
      color = 0xffffff,
      opacity = 0.9,
      wind = [0.5, 0]
    } = options

    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * range
      positions[i * 3 + 1] = Math.random() * height
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * range
      seeds[i] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

    const uSpeed = uniform(speed)
    const uRange = uniform(range)
    const uHeight = uniform(height)
    const uTime = uniform(0)
    const uSize = uniform(size)
    const uTurbulence = uniform(turbulence)
    const uWind = uniform(new THREE.Vector2(wind[0], wind[1]))
    const uPixelRatio = uniform(Math.min(window.devicePixelRatio || 1, 2))
    const uColor = uniform(new THREE.Color(color))
    const uOpacity = uniform(opacity)

    const material = new PointsNodeMaterial()
    material.transparent = true
    material.depthWrite = false

    const animatedPosition = Fn(() => {
      const aSeed = attribute<'float'>('aSeed', 'float')
      const p = positionGeometry

      const fallSpeed = uSpeed.mul(float(0.6).add(aSeed.mul(0.8)))
      const y = mod(p.y.sub(uTime.mul(fallSpeed)), uHeight)

      const xz = mod(p.xz.add(uWind.mul(uTime)).add(uRange.mul(2.0)), uRange.mul(2.0)).sub(
        uRange
      )

      // Each flake sways on its own phase instead of falling in a straight line.
      const phase = aSeed.mul(6.2831853)
      const x = xz.x.add(sin(uTime.mul(1.3).add(phase)).mul(uTurbulence))
      const z = xz.y.add(cos(uTime.mul(1.1).add(phase.mul(1.7))).mul(uTurbulence))

      return vec3(x, y, z)
    })()

    material.positionNode = animatedPosition

    material.sizeNode = Fn(() => {
      const aSeed = attribute<'float'>('aSeed', 'float')
      const viewPosition = modelViewMatrix.mul(vec4(animatedPosition, 1.0))
      return uSize
        .mul(float(0.6).add(aSeed.mul(0.8)))
        .mul(uPixelRatio)
        .mul(float(10.0).div(viewPosition.z.negate()))
    })()

    // Soft radial sprite.
    material.colorNode = uColor
    material.opacityNode = Fn(() => {
      // `pointUV` is a vec2 node at runtime; its typings omit the vec2 node extensions.
      // @ts-expect-error PointUVNode typings are missing the vec2 extensions
      const dist = length(vec2(pointUV).sub(vec2(0.5, 0.5)).mul(2.0))
      return oneMinus(smoothstep(float(0.6), float(1.0), dist)).mul(uOpacity)
    })()

    this.mesh = new THREE.Points(geometry, material)
    this.mesh.frustumCulled = false
    this.uTime = uTime
  }

  update(delta: number): void {
    this.time += delta
    this.uTime.value = this.time
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
