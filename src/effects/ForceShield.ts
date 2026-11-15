import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Discard,
  Fn,
  If,
  abs,
  acos,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  dot,
  float,
  floor,
  fract,
  max,
  min,
  mix,
  modelNormalMatrix,
  modelViewMatrix,
  modelWorldMatrix,
  mx_noise_float,
  normalLocal,
  normalize,
  positionLocal,
  pow,
  select,
  sin,
  smoothstep,
  step,
  uniform,
  varying,
  vec2,
  vec3,
  vec4
} from 'three/tsl'

/** Number of simultaneous impacts tracked by the shader. */
const MAX_HITS = 6

export interface ForceShieldOptions {
  /** Sphere radius. Default `1.8`. */
  radius?: number
  /** Whether the shield is raised (`true`) or dissolved (`false`). Default `true`. */
  active?: boolean
  /** Freeze the dissolve at this progress (`0` visible, `1` dissolved). */
  reveal?: number
  /** Speed of the automatic dissolve animation. Default `3.5`. */
  revealSpeed?: number
  /** Base shield color. Default `0x26aeff`. */
  color?: THREE.ColorRepresentation
  /** Overall surface opacity. Default `0.76`. */
  opacity?: number
  /** Hex grid tiling. Default `3`. */
  hexScale?: number
  /** Hex cell brightness. Default `0.13`. */
  hexOpacity?: number
  /** Draw the hexagonal cell grid. Default `true`. */
  showHex?: boolean
  /** Hex seam width. Default `0.06`. */
  edgeWidth?: number
  /** Fresnel falloff exponent. Default `1.8`. */
  fresnelPower?: number
  /** Fresnel edge brightness. Default `1.75`. */
  fresnelStrength?: number
  /** Y (object space) below which the shield fades to the ground. `-1` disables it. Default `0`. */
  fadeStart?: number
  /** Cell flicker speed. Default `0.6`. */
  flashSpeed?: number
  /** Cell flicker brightness. Default `0.11`. */
  flashIntensity?: number
  /** Dissolve noise scale. Default `1.3`. */
  noiseScale?: number
  /** Color of the dissolve edge. Default `0x26aeff`. */
  noiseEdgeColor?: THREE.ColorRepresentation
  /** Width of the dissolve edge. Default `0.02`. */
  noiseEdgeWidth?: number
  /** Brightness of the dissolve edge. Default `10`. */
  noiseEdgeIntensity?: number
  /** Sharpness of the dissolve edge. Default `0.5`. */
  noiseEdgeSmoothness?: number
  /** Flow noise scale. Default `2.4`. */
  flowScale?: number
  /** Flow noise speed. Default `1.13`. */
  flowSpeed?: number
  /** Flow noise brightness. Default `4`. */
  flowIntensity?: number
  /** Speed of the impact ring. Default `1.75`. */
  hitRingSpeed?: number
  /** Thickness of the impact ring. Default `0.12`. */
  hitRingWidth?: number
  /** Maximum angular radius of the impact ring. Default `0.85`. */
  hitMaxRadius?: number
  /** Seconds an impact stays visible. Default `1.8`. */
  hitDuration?: number
  /** Brightness of the impact. Default `4.1`. */
  hitIntensity?: number
  /** Angular radius of the contact highlight. Default `0.3`. */
  hitImpactRadius?: number
  /** Health removed per hit, in percent. Default `5`. */
  hitDamage?: number
  /** Initial shield health (`1` intact, `0` depleted). Default `1`. */
  life?: number
}

const defaults = {
  radius: 1.8,
  active: true,
  revealSpeed: 3.5,
  color: 0x26aeff,
  opacity: 0.76,
  hexScale: 3,
  hexOpacity: 0.13,
  showHex: true,
  edgeWidth: 0.06,
  fresnelPower: 1.8,
  fresnelStrength: 1.75,
  fadeStart: 0,
  flashSpeed: 0.6,
  flashIntensity: 0.11,
  noiseScale: 1.3,
  noiseEdgeColor: 0x26aeff,
  noiseEdgeWidth: 0.02,
  noiseEdgeIntensity: 10,
  noiseEdgeSmoothness: 0.5,
  flowScale: 2.4,
  flowSpeed: 1.13,
  flowIntensity: 4,
  hitRingSpeed: 1.75,
  hitRingWidth: 0.12,
  hitMaxRadius: 0.85,
  hitDuration: 1.8,
  hitIntensity: 4.1,
  hitImpactRadius: 0.3,
  hitDamage: 5,
  life: 1
}

function buildShieldMaterial(options: ForceShieldOptions) {
  const radius = options.radius ?? defaults.radius
  const fadeStart = options.fadeStart ?? defaults.fadeStart

  const uniforms = {
    uTime: uniform(0),
    uColor: uniform(new THREE.Color(options.color ?? defaults.color)),
    uLife: uniform(options.life ?? defaults.life),
    uReveal: uniform(options.reveal ?? ((options.active ?? defaults.active) ? 0 : 1)),
    uHexScale: uniform(options.hexScale ?? defaults.hexScale),
    uHexOpacity: uniform(options.hexOpacity ?? defaults.hexOpacity),
    uShowHex: uniform((options.showHex ?? defaults.showHex) ? 1 : 0),
    uEdgeWidth: uniform(options.edgeWidth ?? defaults.edgeWidth),
    uFresnelPower: uniform(options.fresnelPower ?? defaults.fresnelPower),
    uFresnelStrength: uniform(options.fresnelStrength ?? defaults.fresnelStrength),
    uOpacity: uniform(options.opacity ?? defaults.opacity),
    uFadeStart: uniform(fadeStart),
    uFlashSpeed: uniform(options.flashSpeed ?? defaults.flashSpeed),
    uFlashIntensity: uniform(options.flashIntensity ?? defaults.flashIntensity),
    uNoiseScale: uniform(options.noiseScale ?? defaults.noiseScale),
    uNoiseEdgeColor: uniform(new THREE.Color(options.noiseEdgeColor ?? defaults.noiseEdgeColor)),
    uNoiseEdgeWidth: uniform(options.noiseEdgeWidth ?? defaults.noiseEdgeWidth),
    uNoiseEdgeIntensity: uniform(options.noiseEdgeIntensity ?? defaults.noiseEdgeIntensity),
    uNoiseEdgeSmoothness: uniform(options.noiseEdgeSmoothness ?? defaults.noiseEdgeSmoothness),
    uFlowScale: uniform(options.flowScale ?? defaults.flowScale),
    uFlowSpeed: uniform(options.flowSpeed ?? defaults.flowSpeed),
    uFlowIntensity: uniform(options.flowIntensity ?? defaults.flowIntensity),
    uHitRingSpeed: uniform(options.hitRingSpeed ?? defaults.hitRingSpeed),
    uHitRingWidth: uniform(options.hitRingWidth ?? defaults.hitRingWidth),
    uHitMaxRadius: uniform(options.hitMaxRadius ?? defaults.hitMaxRadius),
    uHitDuration: uniform(options.hitDuration ?? defaults.hitDuration),
    uHitIntensity: uniform(options.hitIntensity ?? defaults.hitIntensity),
    uHitImpactRadius: uniform(options.hitImpactRadius ?? defaults.hitImpactRadius),
    hitPos: Array.from({ length: MAX_HITS }, () => uniform(new THREE.Vector3())),
    hitTime: Array.from({ length: MAX_HITS }, () => uniform(-999))
  }

  const vObjPos = varying(vec3(0))
  const vNormal = varying(vec3(0))
  const vViewDir = varying(vec3(0))

  const vertexNode = Fn(() => {
    const worldPosition = modelWorldMatrix.mul(vec4(positionLocal, 1))

    vObjPos.assign(positionLocal)
    vNormal.assign(normalize(modelNormalMatrix.mul(normalLocal)))
    vViewDir.assign(normalize(cameraPosition.sub(worldPosition.xyz)))

    return cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(positionLocal, 1)))
  })()

  const fragmentNode = Fn(() => {
    const normal = normalize(vNormal)
    const viewDir = normalize(vViewDir)

    // Dissolve mask: the shield materialises as uReveal travels from 1 to 0.
    const dissolve = mx_noise_float(vObjPos.mul(uniforms.uNoiseScale)).mul(0.5).add(0.5)
    const revealMask = smoothstep(uniforms.uReveal.sub(uniforms.uNoiseEdgeWidth), uniforms.uReveal, dissolve)
    If(revealMask.lessThan(0.001), () => {
      Discard()
    })

    const edgeRange = uniforms.uNoiseEdgeWidth.mul(mix(float(0.98), float(0.15), uniforms.uNoiseEdgeSmoothness))
    const dissolveEdge = smoothstep(
      uniforms.uReveal.sub(edgeRange),
      uniforms.uReveal,
      dissolve
    ).mul(float(1).sub(revealMask))

    const fresnel = pow(float(1).sub(dot(normal, viewDir)), uniforms.uFresnelPower).mul(uniforms.uFresnelStrength)

    // Layered flow noise drifting across the surface.
    const flowTime = uniforms.uTime.mul(uniforms.uFlowSpeed)
    const flowA = mx_noise_float(
      vObjPos.mul(uniforms.uFlowScale).add(vec3(flowTime, flowTime.mul(0.6), flowTime.mul(0.4)))
    )
    const flowB = mx_noise_float(
      vObjPos
        .mul(uniforms.uFlowScale)
        .mul(2.1)
        .add(vec3(flowTime.mul(-0.5), flowTime.mul(0.9), flowTime.mul(0.3)))
    )
    const flowNoise = flowA.mul(0.6).add(flowB.mul(0.4)).mul(0.5).add(0.5)

    // Tri-planar hex grid: pick the dominant cube face, then tile it.
    const absNormal = abs(normalize(vObjPos))
    const faceFade = smoothstep(float(0.65), float(0.85), max(absNormal.x, max(absNormal.y, absNormal.z)))
    const useX = absNormal.x.greaterThanEqual(absNormal.y).and(absNormal.x.greaterThanEqual(absNormal.z))
    const useY = absNormal.y.greaterThanEqual(absNormal.z)
    const faceUV = select(useX, vObjPos.yz, select(useY, vObjPos.xz, vObjPos.xy))

    const hexSize = vec2(1, 1.7320508)
    const hexPos = faceUV.mul(uniforms.uHexScale)
    const baseA = floor(hexPos.div(hexSize)).add(0.5)
    const baseB = floor(hexPos.sub(vec2(0.5, 1)).div(hexSize)).add(0.5)
    const localA = hexPos.sub(baseA.mul(hexSize))
    const localB = hexPos.sub(baseB.add(0.5).mul(hexSize))
    const pickA = dot(localA, localA).lessThan(dot(localB, localB))
    const cell = select(pickA, localA, localB)
    const cellId = select(pickA, baseA, baseB.add(0.5))
    const absCell = abs(cell)
    const cellDistance = max(dot(absCell, hexSize.mul(0.5)), absCell.x)
    const hexLine = smoothstep(float(0.5).sub(uniforms.uEdgeWidth), float(0.5), cellDistance).mul(faceFade)

    // Per-cell flicker.
    const random = fract(sin(dot(cellId, vec2(127.1, 311.7))).mul(43758.5453))
    const flash = smoothstep(
      float(0.6),
      float(1),
      sin(uniforms.uTime.mul(uniforms.uFlashSpeed).mul(random.mul(1.5).add(0.5)).add(random.mul(6.2831)))
    )
      .mul(uniforms.uFlashIntensity)
      .mul(faceFade)

    // Impact rings, unrolled per slot so no dynamic array indexing is needed.
    const normPos = normalize(vObjPos)
    const ringContribution = float(0).toVar()
    const hitHighlight = float(0).toVar()

    for (let i = 0; i < MAX_HITS; i += 1) {
      const elapsed = uniforms.uTime.sub(uniforms.hitTime[i])
      const live = step(float(0), uniforms.hitTime[i])
        .mul(step(float(0), elapsed))
        .mul(step(elapsed, uniforms.uHitDuration))

      const distance = acos(clamp(dot(normPos, normalize(uniforms.hitPos[i])), float(-1), float(1)))
      const ringRadius = min(elapsed.mul(uniforms.uHitRingSpeed), uniforms.uHitMaxRadius)
      const wobble = mx_noise_float(normPos.mul(5).add(vec3(elapsed.mul(2)))).mul(0.05)

      const ring = float(1).sub(
        smoothstep(float(0), uniforms.uHitRingWidth, abs(distance.add(wobble).sub(ringRadius)))
      )
      const contact = float(1).sub(smoothstep(float(0), uniforms.uHitImpactRadius, distance))
      const contactFade = float(1).sub(smoothstep(float(0), uniforms.uHitDuration.mul(0.35), elapsed))
      const ringFade = float(1).sub(
        smoothstep(uniforms.uHitMaxRadius.mul(0.75), uniforms.uHitMaxRadius, ringRadius)
      )
      const fadeOut = float(1).sub(smoothstep(uniforms.uHitDuration.mul(0.5), uniforms.uHitDuration, elapsed))

      ringContribution.addAssign(ring.mul(ringFade).mul(fadeOut).mul(live))
      hitHighlight.addAssign(contact.mul(contactFade).mul(live))
    }

    const ringEnergy = min(ringContribution, float(2))
    const hitBoost = min(hitHighlight, float(1))

    // Depleted shields turn red.
    const lifeColor = mix(vec3(1, 0.08, 0.04), uniforms.uColor, uniforms.uLife)

    const hexOpacity = uniforms.uHexOpacity.add(hitBoost.mul(uniforms.uHitIntensity)).mul(uniforms.uShowHex)
    const intensity = hexLine
      .mul(hexOpacity)
      .mul(fresnel.mul(0.7).add(0.3))
      .add(fresnel.mul(0.4))
      .add(flash.mul(uniforms.uShowHex))

    const shieldColor = lifeColor
      .mul(intensity)
      .mul(2)
      .add(lifeColor.mul(flowNoise.mul(fresnel).mul(uniforms.uFlowIntensity)))
      .add(lifeColor.mul(ringEnergy).mul(uniforms.uHitIntensity))

    const edgeColor = mix(uniforms.uNoiseEdgeColor, lifeColor, float(1).sub(uniforms.uLife))
    const edgeGlow = edgeColor.mul(dissolveEdge).mul(uniforms.uNoiseEdgeIntensity)

    const edgeAlpha = dissolveEdge.mul(uniforms.uNoiseEdgeIntensity).mul(0.5)
    const alpha = clamp(
      intensity.mul(uniforms.uOpacity).mul(revealMask).add(edgeAlpha),
      float(0),
      float(1)
    )

    // Dissolve the surface toward the ground plane.
    const bottomFade =
      fadeStart <= -0.999 ? float(1) : smoothstep(float(-1), uniforms.uFadeStart, vObjPos.y.div(radius))

    const finalColor = shieldColor.add(edgeGlow)
    const finalAlpha = alpha.mul(bottomFade)

    return vec4(finalColor, finalAlpha)
  })()

  const material = new NodeMaterial()
  material.vertexNode = vertexNode
  material.fragmentNode = fragmentNode
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.FrontSide

  return { material, uniforms }
}

type ForceShieldUniforms = ReturnType<typeof buildShieldMaterial>['uniforms']

/**
 * Hexagonal force field. The shield animates itself: construction starts the
 * dissolve-in, `setActive()` raises or lowers it, `hit()` fires an impact ring
 * and drains health, and `life` can be written to restore or deplete it.
 */
export default class ForceShield extends THREE.Mesh<THREE.SphereGeometry, NodeMaterial> {
  private readonly uniforms: ForceShieldUniforms
  private readonly radius: number
  private readonly revealSpeed: number
  private readonly hitDamage: number
  private readonly startedAt = performance.now()

  private lastTime = 0
  private hitIndex = 0
  private disposed = false
  private activeValue: boolean
  private manualReveal: boolean

  constructor(options: ForceShieldOptions = {}) {
    const radius = options.radius ?? defaults.radius
    const { material, uniforms } = buildShieldMaterial({ ...options, radius })

    super(new THREE.SphereGeometry(radius, 64, 64), material)

    this.radius = radius
    this.uniforms = uniforms
    this.revealSpeed = options.revealSpeed ?? defaults.revealSpeed
    this.hitDamage = options.hitDamage ?? defaults.hitDamage
    this.activeValue = options.active ?? defaults.active
    this.manualReveal = options.reveal !== undefined

    this.onBeforeRender = () => {
      this.tick()
    }
  }

  /** Whether the shield is currently raised. */
  get active(): boolean {
    return this.activeValue
  }

  /** Raise (`true`) or dissolve (`false`) the shield with its own animation. */
  setActive(active: boolean): void {
    this.activeValue = active
    this.manualReveal = false
  }

  /** Dissolve progress: `0` fully visible, `1` fully dissolved. */
  get reveal(): number {
    return this.uniforms.uReveal.value
  }

  /**
   * Scrub the dissolve manually. Writing this freezes the automatic
   * animation until `setActive()` is called again.
   */
  set reveal(value: number) {
    this.manualReveal = true
    this.uniforms.uReveal.value = THREE.MathUtils.clamp(value, 0, 1)
  }

  /** Shield health: `1` intact, `0` fully red. */
  get life(): number {
    return this.uniforms.uLife.value
  }

  set life(value: number) {
    this.uniforms.uLife.value = THREE.MathUtils.clamp(value, 0, 1)
  }

  /** Radius of the shield sphere. */
  get shieldRadius(): number {
    return this.radius
  }

  /**
   * Fire an impact. Pass a world-space point to aim it, or omit it for a random
   * spot on the surface. Each hit drains `hitDamage` percent of health.
   */
  hit(point?: THREE.Vector3, damage?: number): void {
    const index = this.hitIndex % MAX_HITS
    this.hitIndex += 1

    const localPoint = point ? this.worldToLocal(point.clone()) : this.randomPoint()
    this.uniforms.hitPos[index].value.copy(localPoint)
    this.uniforms.hitTime[index].value = this.elapsed

    this.life = this.life - (damage ?? this.hitDamage) / 100
  }

  /** Remove the shield from its parent and release its GPU resources. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
  }

  private get elapsed(): number {
    return (performance.now() - this.startedAt) / 1000
  }

  private randomPoint(): THREE.Vector3 {
    const y = Math.random() * 2 - 1
    const angle = Math.random() * Math.PI * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))

    return new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring).multiplyScalar(this.radius)
  }

  private tick(): void {
    const elapsed = this.elapsed
    const delta = Math.min(Math.max(elapsed - this.lastTime, 0), 0.1)
    this.lastTime = elapsed
    this.uniforms.uTime.value = elapsed

    if (this.manualReveal) return

    const target = this.activeValue ? 0 : 1
    const current = this.uniforms.uReveal.value

    if (current === target) return

    let next = THREE.MathUtils.lerp(current, target, 1 - Math.exp(-this.revealSpeed * delta))
    if (Math.abs(target - next) < 0.002) next = target

    this.uniforms.uReveal.value = next
  }
}
