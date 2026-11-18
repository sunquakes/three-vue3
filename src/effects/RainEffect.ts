import * as THREE from 'three'
import { PointsNodeMaterial } from 'three/webgpu'
import {
  Fn,
  attribute,
  float,
  mix,
  mod,
  oneMinus,
  positionGeometry,
  modelViewMatrix,
  pointUV,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
  abs
} from 'three/tsl'

export interface RainEffectOptions {
  /** Number of drops, default: 2000 */
  count?: number
  /** Fall speed in world units per second, default: 20 */
  speed?: number
  /** Horizontal half-extent of the rain volume, default: 40 */
  range?: number
  /** Vertical extent of the rain volume, default: 30 */
  height?: number
  /** Drop color, default: 0xaaccff */
  color?: number
  /** Drop opacity, default: 0.6 */
  opacity?: number
  /** Horizontal wind drift in world units per second, default: [2, 0] */
  wind?: [number, number]
}

/**
 * Lightweight rain built from a single `THREE.Points` cloud. Drops fall and
 * drift with wind inside a box volume and wrap at the edges, so the field is
 * effectively endless without a height map or ground splashes.
 *
 * Built entirely with TSL, so it renders on both `WebGPURenderer` and a classic
 * `WebGLRenderer` (through three's `WebGLNodesHandler`).
 */
export default class RainEffect {
  readonly mesh: THREE.Points<THREE.BufferGeometry, PointsNodeMaterial>

  private time = 0
  private uTime = uniform(0)

  constructor(options: RainEffectOptions = {}) {
    const {
      count = 2000,
      speed = 20,
      range = 40,
      height = 30,
      color = 0xaaccff,
      opacity = 0.6,
      wind = [2, 0]
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

      // Each drop falls at its own rate, wrapping inside the column height.
      const fallSpeed = uSpeed.mul(float(0.7).add(aSeed.mul(0.6)))
      const y = mod(p.y.sub(uTime.mul(fallSpeed)), uHeight)

      // Wind drift wraps too, so drops never leave the volume.
      const xz = mod(p.xz.add(uWind.mul(uTime)).add(uRange.mul(2.0)), uRange.mul(2.0)).sub(
        uRange
      )

      return vec3(xz.x, y, xz.y)
    })()

    material.positionNode = animatedPosition

    // Streak size attenuates with distance.
    material.sizeNode = Fn(() => {
      const aSeed = attribute<'float'>('aSeed', 'float')
      const viewPosition = modelViewMatrix.mul(vec4(animatedPosition, 1.0))
      const base = float(1.0).add(aSeed).mul(uPixelRatio)
      return base.mul(float(40.0).div(viewPosition.z.negate()))
    })()

    // Thin vertical streak inside the point sprite.
    material.colorNode = uColor
    material.opacityNode = Fn(() => {
      const aSeed = attribute<'float'>('aSeed', 'float')
      // `pointUV` is a vec2 node at runtime; its typings omit the vec2 node extensions.
      // @ts-expect-error PointUVNode typings are missing the vec2 extensions
      const coord = vec2(pointUV)
      const x = abs(coord.x.sub(0.5))
      const width = mix(float(0.18), float(0.08), aSeed)
      const fade = smoothstep(float(0.0), float(0.2), coord.y).mul(
        oneMinus(smoothstep(float(0.8), float(1.0), coord.y))
      )
      const alpha = oneMinus(smoothstep(float(0.0), width, x)).mul(fade).mul(uOpacity)
      return alpha
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
