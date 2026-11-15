import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  dot,
  float,
  length,
  max,
  mix,
  positionLocal,
  smoothstep,
  uniform,
  vec3,
  vec4,
  cameraProjectionMatrix,
  modelViewMatrix
} from 'three/tsl'

export interface SignalWaveOptions {
  /** Color of the arc where it is faint, default: 0x2985ff */
  innerColor?: number
  /** Color of the arc where it is dense, default: 0xbdeaff */
  outerColor?: number
  /** In-plane bearing the arc opens towards, default: [1, 0] */
  direction?: [number, number]
  /** Initial life in the 0-1 range, default: 0 */
  life?: number
  /**
   * World-space bearing the pulse travels and the arc opens along, default:
   * [0, 1, 0]. Used by automatic mode.
   */
  bearing?: [number, number, number]
  /** Start point of the travel in world space, default: [0, 0, 0] */
  origin?: [number, number, number]
  /**
   * World distance the pulse covers in one cycle. When set, the wave animates
   * itself — position, scale, billboard and `life` are all driven from its own
   * clock, so no per-frame code is needed. Omit it to drive `life` manually.
   */
  travel?: number
  /** Seconds per cycle in automatic mode, default: 2.4 */
  period?: number
  /** Phase offset in the 0-1 range used to stagger pulses, default: 0 */
  phase?: number
  /** Number of staggered pulses created as children, default: 1 */
  count?: number
  /** Scale at the start of a cycle, default: 0.45 */
  startScale?: number
  /** Scale at the end of a cycle, default: 3.4 */
  endScale?: number
}

// Arc colors are shader constants, not managed material colors, so unpack the
// hex straight to 0-1 channels instead of going through color management.
function toRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1
}

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()

/**
 * Broadcast ping. A billboarded quad paints one soft-edged arc in the fragment
 * node; grow the mesh scale while `life` runs from 0 to 1 and each pulse reads
 * as a signal that spreads outwards and dies away.
 *
 * Manual mode: position, scale and billboard the quad yourself and drive
 * `life` every frame, aiming the arc with `setDirection()` and `faceCamera()`.
 *
 * Automatic mode: pass `travel` and the wave animates itself along `bearing`
 * from `origin` — `new SignalWave({ travel: 26, bearing: [0.24, 1, 0] })` needs
 * no animation loop. `count` adds staggered pulses as children, so one object
 * renders a whole stream of pings.
 */
export default class SignalWave extends THREE.Mesh<THREE.PlaneGeometry, NodeMaterial> {
  private readonly lifeUniform: ReturnType<typeof uniform>
  private readonly directionUniform: ReturnType<typeof uniform>
  private readonly autoTravel?: number
  private readonly autoPeriod: number
  private phase: number
  private readonly originVector: THREE.Vector3
  private readonly bearingVector: THREE.Vector3
  private readonly startScale: number
  private readonly endScale: number
  /**
   * Own monotonic clock, the same pattern GlowSprite uses. TSL's `time`
   * uniform is only refreshed while a shader actually samples it, and this
   * shader only reads `life`, so the wave keeps its clock instead.
   */
  private readonly startedAt = performance.now()
  private disposed = false

  constructor(options: SignalWaveOptions = {}) {
    const {
      innerColor = 0x2985ff,
      outerColor = 0xbdeaff,
      direction = [1, 0],
      life = 0,
      bearing = [0, 1, 0],
      origin = [0, 0, 0],
      travel,
      period = 2.4,
      phase,
      count = 1,
      startScale = 0.45,
      endScale = 3.4
    } = options

    const autoTravel = travel !== undefined && travel > 0 ? travel : undefined
    // In automatic mode the phase replaces the initial life.
    const startPhase = phase ?? life

    // A 2x2 quad keeps positionLocal.xy in the -1..1 range the arc math expects;
    // the pulse size comes from scaling the mesh, not from the geometry.
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uLife = uniform(autoTravel !== undefined ? startPhase : life)
    const uDirection = uniform(new THREE.Vector2(direction[0], direction[1]))
    const [ir, ig, ib] = toRgb(innerColor)
    const [or, og, ob] = toRgb(outerColor)

    const material = new NodeMaterial()
    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.side = THREE.DoubleSide
    material.fog = false

    material.vertexNode = Fn(() => {
      return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0))
    })()

    material.fragmentNode = Fn(() => {
      const radius = length(positionLocal.xy)
      // Direction from the centre, guarded against the degenerate centre vertex.
      const directionToFragment = positionLocal.xy.div(max(radius, 0.0001))
      // Thin ring band with soft shoulders so the arc has no hard edge.
      const band = smoothstep(0.6, 0.76, radius).mul(float(1.0).sub(smoothstep(0.92, 1.0, radius)))
      // Only the half of the ring facing the bearing survives: an arc, not a circle.
      const arc = smoothstep(0.18, 0.72, dot(directionToFragment, uDirection))
      const fadeIn = smoothstep(0.0, 0.16, uLife)
      const fadeOut = float(1.0).sub(smoothstep(0.2, 1.0, uLife))
      const intensity = band.mul(arc).mul(fadeIn).mul(fadeOut)
      const color = mix(vec3(ir, ig, ib), vec3(or, og, ob), band.mul(arc))

      return vec4(color.mul(intensity), intensity)
    })()

    super(geometry, material)

    this.lifeUniform = uLife
    this.directionUniform = uDirection
    this.autoTravel = autoTravel
    this.autoPeriod = period
    this.phase = startPhase
    this.originVector = new THREE.Vector3(origin[0], origin[1], origin[2])
    this.bearingVector = new THREE.Vector3(bearing[0], bearing[1], bearing[2])
    if (this.bearingVector.lengthSq() < 1e-8) this.bearingVector.set(0, 1, 0)
    this.bearingVector.normalize()
    this.startScale = startScale
    this.endScale = endScale
    this.renderOrder = 3
    this.frustumCulled = false

    if (autoTravel !== undefined) {
      const total = Math.max(1, Math.floor(count))
      if (total === 1) {
        // The mesh is the pulse: it advances, billboards and aims itself right
        // before each render.
        this.onBeforeRender = (_renderer, _scene, camera) => this.tick(camera)
      } else {
        // Several pulses: the mesh becomes a static container instead, with
        // its own quad faded fully out (life 1), so the child pulses never
        // inherit a moving or scaling transform.
        ;(this.lifeUniform as unknown as { value: number }).value = 1
        for (let i = 0; i < total; i += 1) {
          this.add(
            new SignalWave({
              innerColor,
              outerColor,
              bearing,
              origin,
              travel,
              period,
              phase: wrap01(startPhase + i / total),
              startScale,
              endScale
            })
          )
        }
      }
    }
  }

  /** Pulse life, 0 fades in at the origin and 1 fades out at the end */
  public get life(): number {
    if (this.autoTravel !== undefined) {
      return wrap01((performance.now() - this.startedAt) / 1000 / this.autoPeriod + this.phase)
    }
    return (this.lifeUniform as unknown as { value: number }).value
  }

  public set life(value: number) {
    if (this.autoTravel !== undefined) {
      // Shift the phase so the pulse reads as `value` right now, then keeps
      // travelling from there.
      this.phase = value - (performance.now() - this.startedAt) / 1000 / this.autoPeriod
    } else {
      ;(this.lifeUniform as unknown as { value: number }).value = value
    }
  }

  /** Bearing of the arc inside the quad plane */
  public setDirection(x: number, y: number): void {
    ;(this.directionUniform as unknown as { value: THREE.Vector2 }).value.set(x, y)
  }

  /** Turn the quad towards the camera so the arc is never lost edge-on */
  public faceCamera(camera: THREE.Camera): void {
    this.quaternion.copy(camera.quaternion)
  }

  /**
   * Move the start point of the travel in world space, so the stream can be
   * emitted by something that moves. Applies to the staggered child pulses too.
   */
  public setOrigin(x: number, y: number, z: number): void {
    this.originVector.set(x, y, z)
    for (const child of this.children) {
      if (child instanceof SignalWave) child.setOrigin(x, y, z)
    }
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    // Dispose the staggered child pulses created by `count`.
    for (const child of [...this.children]) {
      if (child instanceof SignalWave) child.dispose()
    }

    this.parent?.remove(this)
    this.geometry.dispose()
    this.material.dispose()
  }

  private tick(camera: THREE.Camera): void {
    if (this.disposed || this.autoTravel === undefined) return

    const life = wrap01((performance.now() - this.startedAt) / 1000 / this.autoPeriod + this.phase)
    ;(this.lifeUniform as unknown as { value: number }).value = life
    this.position.copy(this.originVector).addScaledVector(this.bearingVector, life * this.autoTravel)
    this.scale.setScalar(THREE.MathUtils.lerp(this.startScale, this.endScale, life))

    // Billboard towards the camera and aim the arc along the world bearing.
    this.quaternion.copy(camera.quaternion)
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    const px = this.bearingVector.dot(_right)
    const py = this.bearingVector.dot(_up)
    if (px * px + py * py > 1e-6) {
      ;(this.directionUniform as unknown as { value: THREE.Vector2 }).value.set(px, py).normalize()
    }

    // The renderer computed matrixWorld before this hook ran; refresh it so
    // the shader picks up the moved transform in the same frame.
    this.updateMatrixWorld()
  }
}
