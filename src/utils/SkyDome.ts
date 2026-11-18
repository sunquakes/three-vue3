import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  abs,
  float,
  dot,
  length,
  max,
  mix,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
  viewportSize,
  varying,
  cameraProjectionMatrix,
  modelViewMatrix
} from 'three/tsl'
import { globalParameterBus } from './ParameterBus'

export interface SkyDomeOptions {
  /** Radius of the dome sphere, default: 420 */
  radius?: number
  /** Color of the band lying on the horizon, default: 0xf27536 */
  horizonColor?: number
  /** Color just above the horizon, default: 0x803624 */
  lowerSkyColor?: number
  /** Color of the intermediate band, default: 0x260f13 */
  upperSkyColor?: number
  /** Color at the top of the dome, default: 0x060409 */
  zenithColor?: number
  /** Color of the wide halo around the sun, default: 0xff9947 */
  glowColor?: number
  /** Color of the sun disc, default: 0xffe0b8 */
  sunColor?: number
  /** Brightness multiplier of the sun disc, default: 2.4 */
  sunIntensity?: number
  /** Angular diameter of the sun disc in degrees, default: 10 */
  sunSize?: number
  /** Horizontal segment count of the dome sphere, default: 48 */
  segments?: number
}

// Sky colors are shader constants, not managed material colors, so unpack the
// hex straight to 0-1 channels instead of going through color management.
function toRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

/**
 * Gradient sky dome with a low sun: four color bands rising from the horizon to
 * the zenith plus a halo and a disc around a sun direction. Written in TSL so
 * the classic WebGLRenderer can compile it through WebGLNodesHandler as well.
 */
export default class SkyDome extends THREE.Mesh<THREE.SphereGeometry, NodeMaterial> {
  private disposed = false

  private unsubscribeSunDirection: (() => void) | null = null

  constructor(options: SkyDomeOptions = {}) {
    const {
      radius = 420,
      horizonColor = 0xf27536,
      lowerSkyColor = 0x803624,
      upperSkyColor = 0x260f13,
      zenithColor = 0x060409,
      glowColor = 0xff9947,
      sunColor = 0xffe0b8,
      sunIntensity = 2.4,
      sunSize = 10,
      segments = 48
    } = options

    // Tangent of the sun's angular radius; the disc is a circle of this size on
    // screen instead of a spherical cap, so it stays round when it moves off the
    // camera's optical axis.
    const discRadius = Math.tan(THREE.MathUtils.degToRad(Math.max(sunSize, 0.1) * 0.5))

    const geometry = new THREE.SphereGeometry(
      radius,
      segments,
      Math.max(2, Math.round((segments * 2) / 3))
    )

    const material = new NodeMaterial()
    material.side = THREE.BackSide
    material.depthWrite = false
    material.fog = false

    const vDirection = varying(vec3(0))
    const vClip = varying(vec2(0))
    const vClipW = varying(float(0))
    // Projected sun: xy in NDC, z the disc radius in NDC units, w 1 when the sun
    // is in front of the camera and 0 when it is behind.
    const vSun = varying(vec4(0))
    const uSunDirection = uniform(globalParameterBus.get('sunDirection').clone().normalize())
    const sun = normalize(uSunDirection)
    const [hr, hg, hb] = toRgb(horizonColor)
    const [lr, lg, lb] = toRgb(lowerSkyColor)
    const [ur, ug, ub] = toRgb(upperSkyColor)
    const [zr, zg, zb] = toRgb(zenithColor)
    const [gr, gg, gb] = toRgb(glowColor)
    const [sr, sg, sb] = toRgb(sunColor)

    material.vertexNode = Fn(() => {
      const viewProjection = cameraProjectionMatrix.mul(modelViewMatrix)
      const clipPosition = viewProjection.mul(vec4(positionLocal, 1.0))

      vDirection.assign(normalize(positionLocal))
      // Interpolating clip.xy and clip.w separately is exact under perspective
      // correction, so the fragment stage can rebuild the true screen position.
      vClip.assign(clipPosition.xy)
      vClipW.assign(clipPosition.w)

      // Project the sun direction once per vertex; the fragment stage then draws
      // a round disc around it.
      const sunClip = viewProjection.mul(vec4(sun.mul(radius), 1.0))
      const sunW = max(abs(sunClip.w), 1e-4)
      const sunNdc = sunClip.xy.div(sunW)
      // cameraProjectionMatrix[1][1] = 1 / tan(fovY / 2), which converts the
      // angular radius into NDC units at the centre of the screen.
      const projectionScale = cameraProjectionMatrix.mul(vec4(0.0, 1.0, 0.0, 0.0)).y
      const radiusNdc = projectionScale.mul(discRadius)
      const front = step(0.0, sunClip.w)

      vSun.assign(vec4(sunNdc.x, sunNdc.y, radiusNdc, front))

      return clipPosition
    })()

    material.fragmentNode = Fn(() => {
      const direction = normalize(vDirection)

      // Three overlapping bands: shade the sky from the horizon up.
      const lowBand = smoothstep(-0.05, 0.09, direction.y)
      const midBand = smoothstep(0.07, 0.36, direction.y)
      const highBand = smoothstep(0.3, 0.86, direction.y)
      const sky = mix(
        mix(mix(vec3(hr, hg, hb), vec3(lr, lg, lb), lowBand), vec3(ur, ug, ub), midBand),
        vec3(zr, zg, zb),
        highBand
      )

      // Sun: a wide halo plus a round disc in the same direction. The halo is
      // angular, but the disc is measured in screen space so it never turns into
      // an ellipse when the sun drifts away from the view axis.
      const sunAmount = max(dot(direction, sun), 0.0)
      const glow = pow(sunAmount, 5).mul(0.5).add(pow(sunAmount, 22).mul(0.45))

      const ndc = vClip.div(vClipW)
      const aspect = viewportSize.x.div(viewportSize.y)
      const offset = vec2(ndc.x.sub(vSun.x).mul(aspect), ndc.y.sub(vSun.y))
      const radiusNdc = max(vSun.z, 1e-5)
      const disc = oneMinus(smoothstep(radiusNdc.mul(0.35), radiusNdc, length(offset)))
        .mul(vSun.w)
        .mul(sunIntensity)

      const color = sky.add(vec3(gr, gg, gb).mul(glow)).add(vec3(sr, sg, sb).mul(disc))

      return vec4(color, 1.0)
    })()

    super(geometry, material)

    this.renderOrder = -1000
    this.frustumCulled = false

    this.unsubscribeSunDirection = globalParameterBus.subscribe('sunDirection', (direction) => {
      uSunDirection.value.copy(direction).normalize()
    })
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.unsubscribeSunDirection?.()
    this.unsubscribeSunDirection = null
    this.parent?.remove(this)
    this.geometry.dispose()
    this.material.dispose()
  }
}
