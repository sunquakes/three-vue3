import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  abs,
  float,
  fract,
  length,
  mix,
  mx_noise_float,
  mx_worley_noise_float,
  positionLocal,
  smoothstep,
  time,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
  cameraProjectionMatrix,
  modelViewMatrix
} from 'three/tsl'

export interface RadarSweepOptions {
  /** Outer radius the pulse expands to, default: 8 */
  radius?: number
  /** Radial segment count of the ring, default: 128 */
  segments?: number
  /** Concentric segment count of the ring, default: 20 */
  rings?: number
  /**
   * World-space ground sampler, `(x, z) => height`. When given, the ring is
   * displaced onto the terrain so the pulse follows the ground instead of
   * slicing through it.
   */
  heightAt?: (x: number, z: number) => number
  /** Color of the sweeping bands, default: 0x57ccff */
  color?: number
  /** Color of the leading crest, default: 0xa8f5ff */
  crestColor?: number
  /** Distance the weaker first return trails behind the crest, default: 1.8 */
  echoDelay?: number
  /** Alpha multiplier of the whole pulse, default: 0.9 */
  opacity?: number
  /** Height offset above the terrain, default: 0.04 */
  lift?: number
  /** Initial pulse progress in the 0-1 range, default: 0 */
  progress?: number
  /**
   * Seconds per full sweep. When set, the pulse advances on its own from the
   * render timer and no per-frame code is needed; `progress` still works and
   * sets the phase. Omit it to drive `progress` manually.
   */
  period?: number
}

// Hull colors are shader constants, not managed material colors, so unpack the
// hex straight to 0-1 channels instead of going through color management.
function toRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1
}

// The render timer is a shared uniform node; read its CPU-side value.
function timeSeconds(): number {
  return (time as unknown as { value?: number }).value ?? 0
}

/**
 * Ground-radar pulse. A ring band rolls out from the mesh origin as the
 * `progress` value goes from 0 to 1, broken up by drifting noise so the crest
 * never reads as a drawn circle: a leading edge, a weaker first echo trailing
 * it, the faint already-swept footprint and short blips over buried features.
 *
 * The band is displaced onto the ground once, from the `heightAt` sampler, so
 * it conforms to uneven terrain. Set the mesh position before adding it to the
 * scene (the band is rebuilt on `added`), or call `rebuild()` after moving it.
 *
 * Pass `period` to let the pulse loop on its own — `new RadarSweep({ period: 2.4 })`
 * needs no animation loop. Omit `period` to drive `progress` manually.
 */
export default class RadarSweep extends THREE.Mesh<THREE.RingGeometry, NodeMaterial> {
  private readonly progressUniform: ReturnType<typeof uniform>
  private readonly phaseUniform: ReturnType<typeof uniform>
  private readonly autoPeriod?: number
  private readonly heightAt?: (x: number, z: number) => number
  private readonly lift: number
  private readonly onAdded: () => void
  private disposed = false

  constructor(options: RadarSweepOptions = {}) {
    const {
      radius = 8,
      segments = 128,
      rings = 20,
      heightAt,
      color = 0x57ccff,
      crestColor = 0xa8f5ff,
      echoDelay = 1.8,
      opacity = 0.9,
      lift = 0.04,
      progress = 0,
      period
    } = options

    const autoPeriod = period !== undefined && period > 0 ? period : undefined

    const geometry = new THREE.RingGeometry(0.03, radius, segments, rings)
    // RingGeometry is built on the XY plane, lay it flat on the ground.
    geometry.rotateX(-Math.PI / 2)

    const uProgress = uniform(progress)
    const uPhase = uniform(progress)
    const [cr, cg, cb] = toRgb(color)
    const [er, eg, eb] = toRgb(crestColor)

    const material = new NodeMaterial()
    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.side = THREE.DoubleSide
    material.fog = false

    const vRadius = varying(float(0))
    const vPlanar = varying(vec2(0, 0))

    // Automatic mode derives the pulse position from the render timer inside
    // the shader; manual mode reads the progress uniform.
    const progressSource =
      autoPeriod !== undefined ? fract(time.div(autoPeriod).add(uPhase)) : uProgress

    material.vertexNode = Fn(() => {
      vRadius.assign(length(positionLocal.xz))
      vPlanar.assign(positionLocal.xz)
      return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0))
    })()

    material.fragmentNode = Fn(() => {
      const front = progressSource.mul(radius)
      const drift = time.mul(1.4)
      // Broad patch field: breaks the crest into irregular arcs.
      const patch = mx_noise_float(vec3(vPlanar.mul(2.4), drift))
        .mul(0.5)
        .add(0.5)
      // Fine grain: the speckle real returns arrive with.
      const grain = mx_noise_float(vec3(vPlanar.mul(11.0), drift.add(5.3)))
        .mul(0.5)
        .add(0.5)
      // Range jitter: the wavefront wobbles at grain scale instead of expanding
      // as a clean edge.
      const trail = front.sub(vRadius).add(grain.sub(0.5).mul(0.18))
      // Leading edge, its width modulated by the patch field.
      const crestCore = float(1.0).sub(
        smoothstep(0.0, float(0.22).add(patch.mul(0.36)), abs(trail))
      )
      const crest = crestCore.mul(grain.mul(0.5).add(0.5))
      // First return: a weaker echo a little way behind the crest.
      const echo = float(1.0)
        .sub(smoothstep(0.0, 1.0, abs(trail.sub(echoDelay))))
        .mul(0.4)
        .mul(patch.mul(0.6).add(0.4))
      // Ground already swept keeps a faint, mottled footprint until the next pulse.
      const footprint = smoothstep(0.0, 1.2, trail).mul(float(0.1).add(grain.mul(0.1)))
      // Buried features: strong returns only flash while the front crosses them.
      const cell = mx_worley_noise_float(vPlanar.mul(0.9))
      const blip = float(1.0)
        .sub(smoothstep(0.0, 0.14, cell))
        .mul(crestCore)
        .mul(0.9)
      // The pulse weakens as it spreads, like radar energy lost with range.
      const falloff = float(1.0).sub(progressSource.mul(0.55))
      const intensity = crest.add(echo).add(footprint).add(blip).mul(falloff)
      const color = mix(vec3(cr, cg, cb), vec3(er, eg, eb), crestCore)

      return vec4(color.mul(intensity), intensity.mul(opacity))
    })()

    super(geometry, material)

    this.progressUniform = uProgress
    this.phaseUniform = uPhase
    this.autoPeriod = autoPeriod
    this.heightAt = heightAt
    this.lift = lift
    this.renderOrder = 2
    this.frustumCulled = false

    // The terrain band depends on the world position, which callers usually set
    // right after construction, so bake it once the mesh joins the scene.
    this.onAdded = () => this.rebuild()
    this.addEventListener('added', this.onAdded)
  }

  /** Pulse progress, 0 starts at the origin and 1 is the outer radius */
  public get progress(): number {
    if (this.autoPeriod !== undefined) {
      return wrap01(
        timeSeconds() / this.autoPeriod + (this.phaseUniform as unknown as { value: number }).value
      )
    }
    return (this.progressUniform as unknown as { value: number }).value
  }

  public set progress(value: number) {
    if (this.autoPeriod !== undefined) {
      // Shift the phase so the pulse reads as `value` right now, then keeps
      // looping from there.
      this.phaseUniform.value = value - timeSeconds() / this.autoPeriod
    } else {
      ;(this.progressUniform as unknown as { value: number }).value = value
    }
  }

  /** Re-sample `heightAt` for the current world position */
  public rebuild(): void {
    if (!this.heightAt) return

    const heightAt = this.heightAt
    const positions = this.geometry.attributes.position as THREE.BufferAttribute
    const { x, z } = this.position
    const baseY = this.position.y

    for (let i = 0; i < positions.count; i += 1) {
      const worldX = x + positions.getX(i)
      const worldZ = z + positions.getZ(i)
      positions.setY(i, heightAt(worldX, worldZ) - baseY + this.lift)
    }

    positions.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.removeEventListener('added', this.onAdded)
    this.parent?.remove(this)
    this.geometry.dispose()
    this.material.dispose()
  }
}
