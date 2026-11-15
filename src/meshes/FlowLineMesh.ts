import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
  vec2,
  vec4,
  uv,
  texture,
  varying,
  abs,
  smoothstep,
  mix,
  max,
  fract,
  oneMinus
} from 'three/tsl'
import { AxisType } from '../enums/AxisType'

// V-shaped arrow drawing ported from the previous ShaderMaterial version
function createArrowTexture(arrowColor: [number, number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256

  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const r = Math.round(arrowColor[0] * 255)
  const g = Math.round(arrowColor[1] * 255)
  const b = Math.round(arrowColor[2] * 255)

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

  const arrowWidth = 240
  const arrowHeight = 100
  const lineThickness = 24
  const centerX = 256
  const centerY = 128

  // Upper arm of the V-shaped arrow
  ctx.beginPath()
  ctx.moveTo(centerX - arrowWidth / 2, centerY - arrowHeight / 2)
  ctx.lineTo(centerX + arrowWidth / 2, centerY)
  ctx.lineTo(centerX + arrowWidth / 2 - lineThickness, centerY + lineThickness * 0.5)
  ctx.lineTo(centerX - arrowWidth / 2, centerY - arrowHeight / 2 + lineThickness)
  ctx.closePath()
  ctx.fill()

  // Lower arm of the V-shaped arrow
  ctx.beginPath()
  ctx.moveTo(centerX - arrowWidth / 2, centerY + arrowHeight / 2)
  ctx.lineTo(centerX + arrowWidth / 2, centerY)
  ctx.lineTo(centerX + arrowWidth / 2 - lineThickness, centerY - lineThickness * 0.5)
  ctx.lineTo(centerX - arrowWidth / 2, centerY + arrowHeight / 2 - lineThickness)
  ctx.closePath()
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Keep the seam-prevention settings from the original TSL version
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false

  return texture
}

function createSmoothPoints(points: THREE.Vector3[], segments: number = 100): THREE.Vector3[] {
  if (points.length < 2) return points

  const smoothPoints: THREE.Vector3[] = []
  const curve = new THREE.CatmullRomCurve3(points)
  curve.curveType = 'catmullrom'
  curve.tension = 0.5

  for (let i = 0; i <= segments; i++) {
    smoothPoints.push(curve.getPoint(i / segments))
  }

  return smoothPoints
}

function createLineGeometry(
  points: THREE.Vector3[],
  width: number,
  axis: AxisType
): { geometry: THREE.BufferGeometry; totalLength: number } {
  const geometry = new THREE.BufferGeometry()

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const smoothPoints = createSmoothPoints(points, 120)

  let totalLength = 0
  const lengths: number[] = [0]

  for (let i = 1; i < smoothPoints.length; i++) {
    const prev = smoothPoints[i - 1]
    const curr = smoothPoints[i]
    totalLength += new THREE.Vector3().subVectors(curr, prev).length()
    lengths.push(totalLength)
  }

  for (let i = 0; i < smoothPoints.length; i++) {
    const point = smoothPoints[i]
    const next = i < smoothPoints.length - 1 ? smoothPoints[i + 1] : smoothPoints[i]
    const prev = i > 0 ? smoothPoints[i - 1] : smoothPoints[i]

    const tangent = new THREE.Vector3().subVectors(next, prev).normalize()
    let normal: THREE.Vector3

    if (axis === AxisType.X) {
      normal = new THREE.Vector3(0, tangent.z, -tangent.y).normalize()
    } else if (axis === AxisType.Y) {
      normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    } else {
      normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize()
    }

    const offset = normal.clone().multiplyScalar(width / 2)

    positions.push(
      point.x - offset.x,
      point.y - offset.y,
      point.z - offset.z,
      point.x + offset.x,
      point.y + offset.y,
      point.z + offset.z
    )

    const uvX = lengths[i] / totalLength / width
    uvs.push(uvX, 0, uvX, 1)

    if (i < smoothPoints.length - 1) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  return { geometry, totalLength }
}

function getLineMaterial(
  color: [number, number, number, number],
  arrowColor: [number, number, number],
  textureRepeat?: number
): {
  material: NodeMaterial
  texture: THREE.Texture
  timeUniform: ReturnType<typeof uniform>
  lineColorUniform: { value: THREE.Vector4 }
  arrowColorUniform: { value: THREE.Vector3 }
} {
  const arrowTexture = createArrowTexture(arrowColor)

  const uTime = uniform(0)
  const uLineColor = uniform(new THREE.Vector4().fromArray(color))
  const uArrowColor = uniform(new THREE.Vector3().fromArray(arrowColor))
  const uTextureRepeat = uniform(textureRepeat ?? 10)

  const material = new NodeMaterial()
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.side = THREE.DoubleSide

  const vUv = varying(uv())

  material.fragmentNode = Fn(() => {
    const rawUvX = vUv.x.mul(uTextureRepeat).sub(uTime)
    const scrolledX = fract(rawUvX)

    // Double-sample near the wrap seam to hide texture seams, as in the original TSL version
    const edgeBlend = smoothstep(float(0.0), float(0.02), scrolledX)
    const sampleUv0 = vec2(scrolledX, vUv.y)
    const sampleUv1 = vec2(scrolledX.add(1.0), vUv.y)

    const texColor0 = texture(arrowTexture, sampleUv0)
    const texColor1 = texture(arrowTexture, sampleUv1)
    const texColor = mix(texColor1, texColor0, edgeBlend)

    const centerDist = abs(vUv.y.sub(float(0.5))).mul(2.0)

    const core = oneMinus(smoothstep(float(0), float(0.5), centerDist))
    const glowGradient = oneMinus(smoothstep(float(0.3), float(1.2), centerDist))

    const glowAlpha = glowGradient.mul(oneMinus(centerDist.div(float(1.5))))
    const glow = core.add(glowAlpha.mul(0.8))

    const arrowBrightness = max(max(max(texColor.r, texColor.g), texColor.b), float(0.001))

    const glowColor = uLineColor.rgb.mul(float(1.2).add(glowGradient.mul(0.3)))

    const finalColor = mix(glowColor, uArrowColor.mul(1.3), arrowBrightness)
    const finalAlpha = glow.mul(uLineColor.a)

    return vec4(finalColor, finalAlpha)
  })()

  return {
    material,
    texture: arrowTexture,
    timeUniform: uTime,
    lineColorUniform: uLineColor,
    arrowColorUniform: uArrowColor
  }
}

interface FlowLineMeshOptions {
  points?: THREE.Vector3[]
  width?: number
  color?: [number, number, number, number]
  arrowColor?: [number, number, number]
  axis?: AxisType
  textureRepeat?: number
  speed?: number
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

export default class FlowLineMesh extends THREE.Mesh {
  private timeUniform: ReturnType<typeof uniform>
  private lineColorUniform: { value: THREE.Vector4 }
  private arrowColorUniform: { value: THREE.Vector3 }
  private readonly origLineColor: [number, number, number, number]
  private readonly origArrowColor: [number, number, number]
  private speed: number = 1
  private startTime: number = Date.now()
  private animationId: number | null = null
  private arrowTexture: THREE.Texture | null
  private readonly onAdded: () => void

  constructor(options: FlowLineMeshOptions = {}) {
    const points = options.points ?? [
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(1, 0, 0)
    ]
    const width = options.width ?? 0.05
    const color = options.color ?? [0.086, 0.467, 1, 0.5]
    const arrowColor = options.arrowColor ?? [1, 1, 1]
    const axis = options.axis ?? AxisType.Z
    const textureRepeat = options.textureRepeat ?? 20
    const speed = options.speed ?? 4.0

    const { geometry } = createLineGeometry(points, width, axis)
    const { material, texture, timeUniform, lineColorUniform, arrowColorUniform } = getLineMaterial(
      color,
      arrowColor,
      textureRepeat
    )
    super(geometry, material)
    this.timeUniform = timeUniform
    this.lineColorUniform = lineColorUniform
    this.arrowColorUniform = arrowColorUniform
    this.arrowTexture = texture
    this.origLineColor = [...color] as [number, number, number, number]
    this.origArrowColor = [...arrowColor] as [number, number, number]
    this.speed = speed

    // Auto-detect the renderer from the scene the mesh belongs to: WebGPU
    // converts linear to sRGB on final output, so pre-correct the color so it
    // matches the WebGL output.
    // Keep a reference so the listener can be removed in dispose().
    this.onAdded = () => {
      const scene = this.getScene()
      const renderer = scene?.userData?.renderer as { isWebGPURenderer?: boolean } | undefined
      if (renderer) this.applyColor(renderer.isWebGPURenderer === true)
    }
    this.addEventListener('added', this.onAdded)

    this.startAnimation()
  }

  // Walk up the parent chain to find the scene the mesh belongs to
  private getScene(): THREE.Scene | null {
    return findScene(this)
  }

  // Set the color according to the renderer type; WebGPU needs sRGB brightness
  // pre-correction so it matches the WebGL output.
  private applyColor(isWebGPU: boolean): void {
    const brightness = 0.86
    if (isWebGPU) {
      const [r, g, b, a] = this.origLineColor
      this.lineColorUniform.value.set(
        Math.pow(r, 2.2) * brightness,
        Math.pow(g, 2.2) * brightness,
        Math.pow(b, 2.2) * brightness,
        a
      )
      const [ar, ag, ab] = this.origArrowColor
      this.arrowColorUniform.value.set(
        Math.pow(ar, 2.2) * brightness,
        Math.pow(ag, 2.2) * brightness,
        Math.pow(ab, 2.2) * brightness
      )
    } else {
      this.lineColorUniform.value.fromArray(this.origLineColor)
      this.arrowColorUniform.value.fromArray(this.origArrowColor)
    }
  }

  private startAnimation() {
    this.startTime = Date.now()
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      const now = Date.now()
      const time = ((now - this.startTime) / 1000) * this.speed
      ;(this.timeUniform as { value: number }).value = time
    }
    animate()
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.removeEventListener('added', this.onAdded)
    this.parent?.remove(this)
    this.geometry.dispose()
    ;(this.material as NodeMaterial).dispose()
    this.arrowTexture?.dispose()
    this.arrowTexture = null
  }
}
