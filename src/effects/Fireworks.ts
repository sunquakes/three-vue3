import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  Fn,
  If,
  Discard,
  and,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  cross,
  dot,
  float,
  floor,
  fract,
  mix,
  modelViewMatrix,
  modelWorldMatrixInverse,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  select,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4
} from 'three/tsl'

export interface FireworksOptions {
  /** Burst trail target length radius, baked into the geometry, default: 1 */
  radius?: number
  /** Icosahedron subdivision level, baked into the geometry, default: 0 */
  detail?: number
  /** Number of segments sampled along each trail, baked into the geometry, default: 5 */
  segments?: number
  /** Gravity parabola coefficient, baked into the geometry, default: 1 */
  gravity?: number
  /** Ribbon half-width, default: 0.1 */
  width?: number
  /** Animation start time in seconds, default: 0 */
  startTime?: number
  /** Launch phase duration in seconds, default: 1.5 */
  launchDuration?: number
  /** Delay between launch and burst, may be negative to overlap, default: -0.4 */
  delayDuration?: number
  /** Burst phase duration in seconds, default: 2 */
  burstDuration?: number
  /** Burst height along the local Y axis, default: 6.5 */
  burstHeight?: number
  /** Overall burst scale, default: 3.5 */
  burstScale?: number
  /** Burst origin offset, default: (0, 0, 0) */
  burstPositionOffset?: THREE.Vector3
  /** Replay the effect when one cycle finishes, default: true */
  loop?: boolean
  /** Base ribbon color, default: '#ffd4a0' */
  color?: THREE.ColorRepresentation
  /** Head glow intensity, default: 9 */
  bloomIntensity?: number
  /** Head glow length exponent, larger tightens the tip, default: 18 */
  bloomFalloff?: number
  /** Noise dissolve time exponent, default: 3 */
  noiseFalloff?: number
  /** Noise UV scale (across, along), default: (10, 200) */
  noiseScale?: THREE.Vector2
}

interface FireworksGeometryOptions {
  radius: number
  detail: number
  segments: number
  gravity: number
}

interface NumberUniform {
  value: number
}

interface Vector3Uniform {
  value: THREE.Vector3
}

interface Vector2Uniform {
  value: THREE.Vector2
}

interface ColorUniform {
  value: THREE.Color
}

interface FireworksUniforms {
  uWidth: NumberUniform
  uTime: NumberUniform
  uStartTime: NumberUniform
  uLaunchDuration: NumberUniform
  uDelayDuration: NumberUniform
  uBurstDuration: NumberUniform
  uBurstHeight: NumberUniform
  uBurstScale: NumberUniform
  uBloomIntensity: NumberUniform
  uBloomFalloff: NumberUniform
  uNoiseFalloff: NumberUniform
  uBurstPositionOffset: Vector3Uniform
  uNoiseScale: Vector2Uniform
  uColor: ColorUniform
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

// Cubic ease-out: maps normalized time t to (t - 1)^3 + 1, fast at the start
// and slow at the end. Drives the growth progress of the launch and burst phases.
const easeCubicOut = Fn(
  ([t]: [Node<'float'>]) => {
    const x = float(t).sub(1.0)
    return x.mul(x).mul(x).add(1.0)
  },
  { t: 'float', return: 'float' }
)

// sin/dot based pseudo random: constant on integer coordinates, uncorrelated
// on neighbours.
const random2 = Fn(
  ([co]: [Node<'vec2'>]) => {
    return fract(sin(dot(co, vec2(12.9898, 78.233))).mul(47453.5453))
  },
  { co: 'vec2', return: 'float' }
)

// 2D value noise: pseudo random values on the integer lattice blended with
// smoothstep interpolation. Used by the fragment stage for the dissolve.
const genericNoise2D = Fn(
  ([p]: [Node<'vec2'>]) => {
    const pos = vec2(p)
    const b = floor(pos)
    const fr = fract(pos)
    // @types/three only exposes a float smoothstep (no vec2 overload), so the
    // interpolation weights are built component-wise.
    const f = vec2(
      smoothstep(float(0.0), float(1.0), fr.x),
      smoothstep(float(0.0), float(1.0), fr.y)
    )
    const d = vec2(0.0, 1.0)
    const n00 = random2(b)
    const n10 = random2(b.add(vec2(d.y, d.x)))
    const n01 = random2(b.add(vec2(d.x, d.y)))
    const n11 = random2(b.add(vec2(d.y, d.y)))
    return mix(mix(n00, n10, f.x), mix(n01, n11, f.x), f.y)
  },
  { p: 'vec2', return: 'float' }
)

// Build the ribbon geometry from icosahedron burst directions:
// 1. build a regular icosahedron, subdivide its faces by `detail`, project onto the sphere;
// 2. dedup directions so each unique ray becomes a single trail;
// 3. sample `segments` points along each ray with a gravity parabola, each sample
//    emitting a left/right pair (uv.x = side, uv.y = normalized arc length);
// 4. append one launch placeholder expanded in the vertex shader.
function createFireworksGeometry(options: FireworksGeometryOptions): THREE.BufferGeometry {
  const { radius, detail, segments, gravity } = options

  const t = (1 + Math.sqrt(5)) / 2
  const vertices = [
    -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0,
    -1, -t, 0, 1
  ]
  const faceIndices = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4,
    2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
  ]

  const vertexBuffer: THREE.Vector3[] = []

  const getVertexByIndex = (index: number, vertex: THREE.Vector3): void => {
    const stride = index * 3
    vertex.set(vertices[stride], vertices[stride + 1], vertices[stride + 2])
  }

  const pushVertex = (vertex: THREE.Vector3): void => {
    // Unique directions only: shared icosahedron corners (and subdivided edge
    // points) would otherwise emit many additive ribbons along the same ray.
    if (vertexBuffer.findIndex((v) => v.equals(vertex)) < 0) {
      vertexBuffer.push(vertex.clone())
    }
  }

  const subdivideFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, faceDetail: number): void => {
    const cols = faceDetail + 1
    const v: THREE.Vector3[][] = []

    for (let i = 0; i <= cols; i++) {
      v[i] = []
      const aj = a.clone().lerp(c, i / cols)
      const bj = b.clone().lerp(c, i / cols)
      const rows = cols - i
      for (let j = 0; j <= rows; j++) {
        if (j === 0 && i === cols) {
          v[i][j] = aj
        } else {
          v[i][j] = aj.clone().lerp(bj, j / rows)
        }
      }
    }

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2)
        if (j % 2 === 0) {
          pushVertex(v[i][k + 1])
          pushVertex(v[i + 1][k])
          pushVertex(v[i][k])
        } else {
          pushVertex(v[i][k + 1])
          pushVertex(v[i + 1][k + 1])
          pushVertex(v[i + 1][k])
        }
      }
    }
  }

  const subdivide = (faceDetail: number): void => {
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    for (let i = 0; i < faceIndices.length; i += 3) {
      getVertexByIndex(faceIndices[i], a)
      getVertexByIndex(faceIndices[i + 1], b)
      getVertexByIndex(faceIndices[i + 2], c)
      subdivideFace(a, b, c, faceDetail)
    }
  }

  const buildGeometry = (trailRadius: number): THREE.BufferGeometry => {
    const positions: number[] = []
    const tangents: number[] = []
    const uvs: number[] = []
    const isBurstTrails: number[] = []
    const indices: number[] = []

    const vertex = new THREE.Vector3()
    const temp = new THREE.Vector3()
    const prev = new THREE.Vector3()
    const tangent = new THREE.Vector3()

    for (let i = 0, il = vertexBuffer.length; i < il; i++) {
      tangent.copy(vertexBuffer[i]).normalize()
      vertex.copy(tangent).multiplyScalar(trailRadius)
      prev.set(0, 0, 0)
      const space = vertex.length() / segments

      positions.push(0, 0, 0, 0, 0, 0)
      uvs.push(1, 0, 0, 0)
      isBurstTrails.push(1, 1)

      let accumulatedDistance = 0
      for (let j = 1; j <= segments; j++) {
        vertex
          .copy(tangent)
          .multiplyScalar(j * space)
          .sub(temp.set(0, 0.5 * gravity * Math.pow(j * space, 2), 0))
        positions.push(vertex.x, vertex.y, vertex.z, vertex.x, vertex.y, vertex.z)

        temp.copy(vertex).sub(prev).normalize()
        if (j === 1) {
          tangents.push(temp.x, temp.y, temp.z, temp.x, temp.y, temp.z)
        }
        tangents.push(temp.x, temp.y, temp.z, temp.x, temp.y, temp.z)

        accumulatedDistance += vertex.distanceTo(prev)
        uvs.push(1, accumulatedDistance, 0, accumulatedDistance)
        isBurstTrails.push(1, 1)
        prev.copy(vertex)
      }

      for (let j = 0; j <= segments; j++) {
        uvs[i * (segments + 1) * 4 + j * 4 + 1] /= accumulatedDistance
        uvs[i * (segments + 1) * 4 + j * 4 + 3] /= accumulatedDistance
      }

      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) * 2 + j * 2
        const b = i * (segments + 1) * 2 + j * 2 + 1
        const c = i * (segments + 1) * 2 + (j + 1) * 2
        const d = i * (segments + 1) * 2 + (j + 1) * 2 + 1
        indices.push(a, b, c, b, d, c)
      }
    }

    // One launch placeholder quad, kept far away until the launch phase is active.
    const offset = positions.length / 3
    positions.push(0, 0, 0, 0, 0, 0)
    tangents.push(1, 1, 1, 1, 1, 1)
    uvs.push(1, 0, 0, 0)
    isBurstTrails.push(0, 0)
    positions.push(1, 1, 1, 1, 1, 1)
    tangents.push(1, 1, 1, 1, 1, 1)
    uvs.push(1, 1, 0, 1)
    isBurstTrails.push(0, 0)
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2)

    vertexBuffer.length = 0

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(tangents, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('isBurstTrail', new THREE.Float32BufferAttribute(isBurstTrails, 1))
    geometry.setIndex(indices)

    return geometry
  }

  subdivide(detail)
  return buildGeometry(radius)
}

interface FireworksMaterialBundle {
  material: NodeMaterial
  uniforms: FireworksUniforms
}

function createFireworksMaterial(options: {
  width: number
  startTime: number
  launchDuration: number
  delayDuration: number
  burstDuration: number
  burstHeight: number
  burstScale: number
  burstPositionOffset: THREE.Vector3
  bloomIntensity: number
  bloomFalloff: number
  noiseFalloff: number
  noiseScale: THREE.Vector2
  color: THREE.ColorRepresentation
}): FireworksMaterialBundle {
  const uWidth = uniform(options.width)
  const uTime = uniform(0.0)
  const uStartTime = uniform(options.startTime)
  const uLaunchDuration = uniform(options.launchDuration)
  const uDelayDuration = uniform(options.delayDuration)
  const uBurstDuration = uniform(options.burstDuration)
  const uBurstHeight = uniform(options.burstHeight)
  const uBurstScale = uniform(options.burstScale)
  const uBurstPositionOffset = uniform(options.burstPositionOffset.clone())
  const uBloomIntensity = uniform(options.bloomIntensity)
  const uBloomFalloff = uniform(options.bloomFalloff)
  const uNoiseFalloff = uniform(options.noiseFalloff)
  const uNoiseScale = uniform(options.noiseScale.clone())
  const uColor = uniform(new THREE.Color(options.color))

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.DoubleSide

  // MeshLocal UV: x in [-1, 1] is the left/right half width, y in [0, 1] the
  // progress along the trail length. Shared between the vertex and fragment
  // stages through a varying.
  const vTrailUv = varying(vec2(0.0))
  // Eased growth progress of the launch or burst phase.
  const vPhaseEased = varying(float(0))
  const vIsBurstTrail = varying(float(0))

  material.vertexNode = Fn(() => {
    const isBurstTrailAttr = attribute<'float'>('isBurstTrail', 'float')
    const tangentAttr = attribute<'vec3'>('tangent', 'vec3')

    const trailUv = vec2(uv().x.mul(2.0).sub(1.0), uv().y)
    vTrailUv.assign(trailUv)
    vIsBurstTrail.assign(isBurstTrailAttr)

    const elapsed = uTime.sub(uStartTime)
    const burstPhase = elapsed.sub(uLaunchDuration).sub(uDelayDuration).div(uBurstDuration)
    const launchPhase = elapsed.div(uLaunchDuration)
    const phaseRaw = select(isBurstTrailAttr.greaterThan(0.5), burstPhase, launchPhase)
    vPhaseEased.assign(easeCubicOut(phaseRaw))

    const active = and(phaseRaw.greaterThan(0.0), phaseRaw.lessThan(1.0))
    const burstOrigin = vec3(
      uBurstPositionOffset.x,
      uBurstPositionOffset.y.add(uBurstHeight),
      uBurstPositionOffset.z
    )
    const burstPos = positionLocal.mul(uBurstScale).add(burstOrigin)
    const launchPos = positionLocal.mul(burstOrigin)
    const center = select(isBurstTrailAttr.greaterThan(0.5), burstPos, launchPos).toVar()
    const localCamera = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1.0)).xyz
    const look = normalize(localCamera.sub(center))
    const localTangent = select(isBurstTrailAttr.greaterThan(0.5), tangentAttr, normalize(burstOrigin))
    const side = normalize(cross(look, localTangent))
    const ribbon = center.add(side.mul(uWidth).mul(trailUv.x).mul(0.5))

    // Inactive phases move the vertices far away so the clip position stays
    // defined and no bright dot is left at the origin.
    const position = select(active, ribbon, vec3(0.0, 1.0e5, 0.0))

    // The vertex node output is assigned straight to gl_Position by the
    // WebGLNodesHandler, so it has to be a fully transformed vec4.
    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(position, 1.0))
  })()

  material.fragmentNode = Fn(() => {
    // Discard the part that has not grown in yet.
    If(vTrailUv.y.greaterThan(vPhaseEased), () => {
      Discard()
    })

    const burstTrail = vIsBurstTrail.greaterThan(0.5)
    const uvScaled = vTrailUv.mul(uNoiseScale)
    const n = oneMinus(genericNoise2D(uvScaled))
    const delayStart = select(burstTrail, float(0.15), float(0.25))
    const falloffMul = select(burstTrail, float(1.0), float(1.3))
    const delayFactor = pow(vPhaseEased, uNoiseFalloff.mul(falloffMul))
      .sub(delayStart)
      .div(oneMinus(delayStart))
    const noiseFade = smoothstep(float(0.0), vPhaseEased, vTrailUv.y.sub(delayFactor))
    If(n.greaterThan(noiseFade), () => {
      Discard()
    })

    // Head bloom: colorFactor peaks at the growth front, bloomFade kills the
    // tip near the end of the phase, the final color is base * (1 + effect).
    const colorFactor = clamp(oneMinus(vPhaseEased.sub(vTrailUv.y)), float(0.0), float(1.0))
    const bloomFade = oneMinus(smoothstep(float(0.85), float(1.0), vPhaseEased))
    const bloomEffect = uBloomIntensity.mul(pow(colorFactor, uBloomFalloff)).mul(bloomFade)

    return vec4(uColor.rgb.mul(float(1.0).add(bloomEffect)), 1.0)
  })()

  return {
    material,
    uniforms: {
      uWidth: uWidth as unknown as NumberUniform,
      uTime: uTime as unknown as NumberUniform,
      uStartTime: uStartTime as unknown as NumberUniform,
      uLaunchDuration: uLaunchDuration as unknown as NumberUniform,
      uDelayDuration: uDelayDuration as unknown as NumberUniform,
      uBurstDuration: uBurstDuration as unknown as NumberUniform,
      uBurstHeight: uBurstHeight as unknown as NumberUniform,
      uBurstScale: uBurstScale as unknown as NumberUniform,
      uBloomIntensity: uBloomIntensity as unknown as NumberUniform,
      uBloomFalloff: uBloomFalloff as unknown as NumberUniform,
      uNoiseFalloff: uNoiseFalloff as unknown as NumberUniform,
      uBurstPositionOffset: uBurstPositionOffset as unknown as Vector3Uniform,
      uNoiseScale: uNoiseScale as unknown as Vector2Uniform,
      uColor: uColor as unknown as ColorUniform
    }
  }
}

export default class Fireworks extends THREE.Mesh {
  private animationId: number | null = null
  private lastTime: number
  private disposed = false
  private loopEnabled: boolean
  private readonly uniforms: FireworksUniforms
  private readonly nodeMaterial: NodeMaterial
  private readonly origColor: THREE.Color
  private readonly onAdded: () => void

  constructor(options: FireworksOptions = {}) {
    const {
      radius = 1.0,
      detail = 0,
      segments = 5,
      gravity = 1.0,
      width = 0.1,
      startTime = 0.0,
      launchDuration = 1.5,
      delayDuration = -0.4,
      burstDuration = 2.0,
      burstHeight = 6.5,
      burstScale = 3.5,
      burstPositionOffset = new THREE.Vector3(0, 0, 0),
      loop = true,
      color = '#ffd4a0',
      bloomIntensity = 9.0,
      bloomFalloff = 18.0,
      noiseFalloff = 3.0,
      noiseScale = new THREE.Vector2(10.0, 200.0)
    } = options

    const geometry = createFireworksGeometry({ radius, detail, segments, gravity })
    const { material, uniforms } = createFireworksMaterial({
      width,
      startTime,
      launchDuration,
      delayDuration,
      burstDuration,
      burstHeight,
      burstScale,
      burstPositionOffset,
      bloomIntensity,
      bloomFalloff,
      noiseFalloff,
      noiseScale,
      color
    })

    super(geometry, material)

    this.name = 'Fireworks'
    // Vertices are expanded in the vertex stage, the geometry bounds no longer
    // describe what is actually drawn.
    this.frustumCulled = false

    this.uniforms = uniforms
    this.nodeMaterial = material
    this.loopEnabled = loop
    this.origColor = new THREE.Color(color)

    // Auto-detect the renderer from the scene the mesh belongs to: WebGPU
    // converts linear to sRGB on final output, so pre-correct the color so it
    // matches the WebGL output.
    this.onAdded = () => {
      const renderer = findScene(this)?.userData?.renderer as { isWebGPURenderer?: boolean } | undefined
      if (renderer) this.applyColor(renderer.isWebGPURenderer === true)
    }
    this.addEventListener('added', this.onAdded)

    this.lastTime = performance.now()
    this.startAnimate()
  }

  // Set the color according to the renderer type; WebGPU needs sRGB brightness
  // pre-correction so it matches the WebGL output.
  private applyColor(isWebGPU: boolean): void {
    const { r, g, b } = this.origColor

    if (isWebGPU) {
      const brightness = 0.86
      this.uniforms.uColor.value.setRGB(
        Math.pow(r, 2.2) * brightness,
        Math.pow(g, 2.2) * brightness,
        Math.pow(b, 2.2) * brightness
      )
    } else {
      this.uniforms.uColor.value.copy(this.origColor)
    }
  }

  private startAnimate(): void {
    const tick = () => {
      this.animationId = requestAnimationFrame(tick)

      const now = performance.now()
      // Clamp the delta so a background tab does not jump the phase on return.
      const delta = Math.min((now - this.lastTime) / 1000, 0.1)
      this.lastTime = now
      this.update(delta)
    }

    tick()
  }

  /** Advance the animation time in seconds. */
  public update(deltaSeconds: number): void {
    const { uTime, uStartTime, uLaunchDuration, uDelayDuration, uBurstDuration } = this.uniforms
    const duration = uLaunchDuration.value + uDelayDuration.value + uBurstDuration.value

    if (this.loopEnabled && uTime.value - uStartTime.value > duration) {
      uTime.value = 0.0
    } else {
      uTime.value += deltaSeconds
    }
  }

  /** Reset the current time to 0 and replay from `startTime`. */
  public restart(): void {
    this.uniforms.uTime.value = 0.0
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

    this.geometry.dispose()
    this.nodeMaterial.dispose()
  }

  get loop(): boolean {
    return this.loopEnabled
  }

  set loop(value: boolean) {
    this.loopEnabled = value
  }

  get width(): number {
    return this.uniforms.uWidth.value
  }

  set width(value: number) {
    this.uniforms.uWidth.value = value
  }

  get startTime(): number {
    return this.uniforms.uStartTime.value
  }

  set startTime(value: number) {
    this.uniforms.uStartTime.value = value
  }

  get launchDuration(): number {
    return this.uniforms.uLaunchDuration.value
  }

  set launchDuration(value: number) {
    this.uniforms.uLaunchDuration.value = value
  }

  get delayDuration(): number {
    return this.uniforms.uDelayDuration.value
  }

  set delayDuration(value: number) {
    this.uniforms.uDelayDuration.value = value
  }

  get burstDuration(): number {
    return this.uniforms.uBurstDuration.value
  }

  set burstDuration(value: number) {
    this.uniforms.uBurstDuration.value = value
  }

  get burstHeight(): number {
    return this.uniforms.uBurstHeight.value
  }

  set burstHeight(value: number) {
    this.uniforms.uBurstHeight.value = value
  }

  get burstScale(): number {
    return this.uniforms.uBurstScale.value
  }

  set burstScale(value: number) {
    this.uniforms.uBurstScale.value = value
  }

  get bloomIntensity(): number {
    return this.uniforms.uBloomIntensity.value
  }

  set bloomIntensity(value: number) {
    this.uniforms.uBloomIntensity.value = value
  }

  get bloomFalloff(): number {
    return this.uniforms.uBloomFalloff.value
  }

  set bloomFalloff(value: number) {
    this.uniforms.uBloomFalloff.value = value
  }

  get noiseFalloff(): number {
    return this.uniforms.uNoiseFalloff.value
  }

  set noiseFalloff(value: number) {
    this.uniforms.uNoiseFalloff.value = value
  }

  get color(): THREE.Color {
    return this.uniforms.uColor.value
  }

  set color(value: THREE.ColorRepresentation) {
    this.uniforms.uColor.value.set(value)
  }

  get burstPositionOffset(): THREE.Vector3 {
    return this.uniforms.uBurstPositionOffset.value
  }

  get noiseScale(): THREE.Vector2 {
    return this.uniforms.uNoiseScale.value
  }
}
