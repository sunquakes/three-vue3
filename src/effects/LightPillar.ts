import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
  vec2,
  vec4,
  uv,
  positionLocal,
  modelViewMatrix,
  cameraProjectionMatrix,
  attribute,
  varying,
  fract,
  pow,
  clamp,
  mix,
  sin,
  distance,
  oneMinus
} from 'three/tsl'

export interface LightPillarOptions {
  /** Pillar color, default: 0x00ffff (cyan) */
  color?: number
  /** Pillar height along the Y axis, default: 3 */
  height?: number
  /** Radius of the cone base sitting on the ground, default: 0.3 */
  radius?: number
  /** Global opacity multiplier (0-1), default: 1 */
  opacity?: number
  /** Animation speed multiplier, default: 1 */
  speed?: number
  /** Radial segment count of the cones and rings, default: 32 */
  segments?: number
  /** Render the breathing glow at the top of the pillar, default: true */
  glow?: boolean
  /** Render the two diffusing pulse rings at the base, default: true */
  ring?: boolean
  /** Outer radius the pulse rings expand to, default: radius * 3 */
  ringRadius?: number
}

interface MaterialBundle {
  material: NodeMaterial
  timeUniform: { value: number }
  colorUniform: { value: THREE.Color }
}

// Walk up the parent chain to find the scene an object belongs to
function findScene(start: THREE.Object3D): THREE.Scene | null {
  let current: THREE.Object3D | null = start
  while (current) {
    if ((current as THREE.Scene).isScene) return current as THREE.Scene
    current = current.parent
  }
  return null
}

// The cone material is shared by the outer shell and the inner core: a
// NodeMaterial per mesh would multiply the compiled programs (and the WebGL2
// uniform buffer bindings) for every pillar in the scene, so the per-mesh
// brightness is supplied through the `aIntensity` geometry attribute instead.
function createConeMaterial(color: number, speed: number, opacity: number): MaterialBundle {
  const uTime = uniform(0)
  const uColor = uniform(new THREE.Color(color))
  const uSpeed = uniform(speed)
  const uOpacity = uniform(opacity)

  const vIntensity = varying(float(0))

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.DoubleSide

  material.vertexNode = Fn(() => {
    vIntensity.assign(attribute<'float'>('aIntensity', 'float'))

    // The vertex node output is assigned straight to gl_Position by the
    // WebGLNodesHandler, so it has to be a fully transformed vec4.
    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0))
  })()

  material.fragmentNode = Fn(() => {
    // Open-ended CylinderGeometry maps v from 0 at the base to 1 at the tip.
    const y = uv().y

    // Base gradient: the pillar is dense on the ground and dissolves upwards.
    const gradient = pow(oneMinus(y), float(1.6))

    // Energy band travelling from the base to the tip.
    const band = pow(fract(y.sub(uTime.mul(uSpeed))), float(9.0))

    const alpha = clamp(
      gradient.mul(0.7).add(band.mul(0.6)).mul(vIntensity).mul(uOpacity),
      float(0.0),
      float(1.0)
    )

    return vec4(uColor.rgb, alpha)
  })()

  return {
    material,
    timeUniform: uTime as unknown as { value: number },
    colorUniform: uColor as unknown as { value: THREE.Color }
  }
}

function createGlowMaterial(
  color: number,
  size: number,
  speed: number,
  opacity: number
): MaterialBundle {
  const uTime = uniform(0)
  const uColor = uniform(new THREE.Color(color))
  const uSize = uniform(size)
  const uSpeed = uniform(speed)
  const uOpacity = uniform(opacity)

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.DoubleSide

  material.vertexNode = Fn(() => {
    // View space billboard: keep the quad facing the camera while the mesh
    // origin still follows the pillar tip through the model view matrix.
    const centerView = modelViewMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0))
    const breathing = float(1.0).add(sin(uTime.mul(uSpeed).mul(2.0)).mul(0.18))
    const scaled = uSize.mul(breathing)

    return cameraProjectionMatrix.mul(
      vec4(
        centerView.x.add(positionLocal.x.mul(scaled)),
        centerView.y.add(positionLocal.y.mul(scaled)),
        centerView.z,
        1.0
      )
    )
  })()

  material.fragmentNode = Fn(() => {
    const d = distance(uv(), vec2(0.5, 0.5)).mul(2.0)
    const core = pow(clamp(oneMinus(d), float(0.0), float(1.0)), float(2.6))

    return vec4(uColor.rgb, core.mul(uOpacity))
  })()

  return {
    material,
    timeUniform: uTime as unknown as { value: number },
    colorUniform: uColor as unknown as { value: THREE.Color }
  }
}

// Both pulse rings share one material; the half cycle offset between them comes
// from the per-ring `aPhase` attribute rather than a second material.
function createRingMaterial(color: number, speed: number, opacity: number): MaterialBundle {
  const uTime = uniform(0)
  const uColor = uniform(new THREE.Color(color))
  const uSpeed = uniform(speed)
  const uOpacity = uniform(opacity)

  const vProgress = varying(float(0))

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.DoubleSide

  material.vertexNode = Fn(() => {
    const phase = attribute<'float'>('aPhase', 'float')
    const progress = fract(uTime.mul(uSpeed).mul(0.5).add(phase))
    vProgress.assign(progress)

    const scaled = positionLocal.mul(mix(float(0.35), float(1.0), progress))

    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(scaled, 1.0))
  })()

  material.fragmentNode = Fn(() => {
    const alpha = pow(oneMinus(vProgress), float(1.8)).mul(uOpacity).mul(0.9)

    return vec4(uColor.rgb, alpha)
  })()

  return {
    material,
    timeUniform: uTime as unknown as { value: number },
    colorUniform: uColor as unknown as { value: THREE.Color }
  }
}

function fillAttribute(geometry: THREE.BufferGeometry, name: string, value: number): void {
  const count = geometry.attributes.position.count
  const array = new Float32Array(count)
  array.fill(value)
  geometry.setAttribute(name, new THREE.BufferAttribute(array, 1))
}

function createConeGeometry(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments: number,
  intensity: number
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, true)
  // CylinderGeometry is centred on the origin, move the base onto the ground.
  geometry.translate(0, height / 2, 0)
  fillAttribute(geometry, 'aIntensity', intensity)

  return geometry
}

function createRingGeometry(radius: number, segments: number, phase: number): THREE.BufferGeometry {
  const geometry = new THREE.RingGeometry(radius * 0.84, radius, segments)
  // RingGeometry is built on the XY plane, lay it flat on the ground.
  geometry.rotateX(-Math.PI / 2)
  fillAttribute(geometry, 'aPhase', phase)

  return geometry
}

export default class LightPillar extends THREE.Group {
  private animationId: number | null = null
  private readonly startTime: number
  private readonly bundles: MaterialBundle[] = []
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly origColor: THREE.Color
  private readonly onAdded: () => void
  private disposed = false

  constructor(options: LightPillarOptions = {}) {
    super()

    const {
      color = 0x00ffff,
      height = 3,
      radius = 0.3,
      opacity = 1,
      speed = 1,
      segments = 32,
      glow = true,
      ring = true,
      ringRadius = radius * 3
    } = options

    this.origColor = new THREE.Color(color)

    const cone = createConeMaterial(color, speed, opacity)
    this.bundles.push(cone)

    const outerGeometry = createConeGeometry(radius, radius * 0.12, height, segments, 0.75)
    const innerGeometry = createConeGeometry(radius * 0.42, radius * 0.05, height, segments, 1.4)
    this.geometries.push(outerGeometry, innerGeometry)
    this.add(new THREE.Mesh(outerGeometry, cone.material))
    this.add(new THREE.Mesh(innerGeometry, cone.material))

    if (glow) {
      const glowBundle = createGlowMaterial(color, radius * 3, speed, opacity)
      this.bundles.push(glowBundle)

      const glowGeometry = new THREE.PlaneGeometry(1, 1)
      this.geometries.push(glowGeometry)

      const glowMesh = new THREE.Mesh(glowGeometry, glowBundle.material)
      glowMesh.position.y = height
      // The billboard is expanded in clip space, so the geometry bounds no
      // longer describe what is actually drawn.
      glowMesh.frustumCulled = false
      this.add(glowMesh)
    }

    if (ring) {
      const ringBundle = createRingMaterial(color, speed, opacity)
      this.bundles.push(ringBundle)

      for (const phase of [0, 0.5]) {
        const ringGeometry = createRingGeometry(ringRadius, segments, phase)
        this.geometries.push(ringGeometry)

        const ringMesh = new THREE.Mesh(ringGeometry, ringBundle.material)
        ringMesh.position.y = 0.01
        ringMesh.frustumCulled = false
        this.add(ringMesh)
      }
    }

    // Auto-detect the renderer from the scene the pillar belongs to: WebGPU
    // converts linear to sRGB on final output, so pre-correct the color so it
    // matches the WebGL output.
    this.onAdded = () => {
      const scene = this.getScene()
      const renderer = scene?.userData?.renderer as { isWebGPURenderer?: boolean } | undefined
      if (renderer) this.applyColor(renderer.isWebGPURenderer === true)
    }
    this.addEventListener('added', this.onAdded)

    this.startTime = performance.now()
    this.startAnimate()
  }

  // Walk up the parent chain to find the scene the pillar belongs to
  private getScene(): THREE.Scene | null {
    return findScene(this)
  }

  // Set the color according to the renderer type; WebGPU needs sRGB brightness
  // pre-correction so it matches the WebGL output.
  private applyColor(isWebGPU: boolean): void {
    const { r, g, b } = this.origColor

    for (const bundle of this.bundles) {
      if (isWebGPU) {
        const brightness = 0.86
        bundle.colorUniform.value.setRGB(
          Math.pow(r, 2.2) * brightness,
          Math.pow(g, 2.2) * brightness,
          Math.pow(b, 2.2) * brightness
        )
      } else {
        bundle.colorUniform.value.copy(this.origColor)
      }
    }
  }

  private startAnimate(): void {
    const tick = () => {
      this.animationId = requestAnimationFrame(tick)

      const elapsed = (performance.now() - this.startTime) / 1000
      for (const bundle of this.bundles) {
        bundle.timeUniform.value = elapsed
      }
    }

    tick()
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    this.removeEventListener('added', this.onAdded)
    this.parent?.remove(this)
    this.clear()

    for (const geometry of this.geometries) {
      geometry.dispose()
    }
    for (const bundle of this.bundles) {
      bundle.material.dispose()
    }

    this.geometries.length = 0
    this.bundles.length = 0
  }
}
