import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  fract,
  distance,
  step,
  oneMinus,
  max,
  mix,
  float,
  vec4,
  positionLocal,
  frontFacing,
  Discard,
  If,
  clamp
} from 'three/tsl'
import { AxisType } from '../enums/AxisType'

interface Array4 extends Array<number> {
  0: number
  1: number
  2: number
  3: number
  length: 4
}

interface WaveCircleMeshOptions {
  verticalAxis?: AxisType
  radius?: number
  color?: Array4
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

function getGeometry(axis: AxisType, radius: number): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(radius)
  const rotateMatrix = new THREE.Matrix4()

  if (axis === AxisType.X) {
    rotateMatrix.makeRotationY(Math.PI / 2)
  } else if (axis === AxisType.Y) {
    rotateMatrix.makeRotationX(-Math.PI / 2)
  }

  geometry.applyMatrix4(rotateMatrix)
  return geometry
}

function getMaterial(
  radius?: number,
  color?: Array4
): {
  material: NodeMaterial
  timeUniform: ReturnType<typeof uniform>
  colorUniform: { value: THREE.Vector4 }
} {
  const uTime = uniform(0)
  const uRadius = uniform(radius ?? 1)
  const uCenter = uniform(new THREE.Vector3(0, 0, 0))

  // Correct color taken from the WebGL screenshot [R,G,B,A]; pre-correction is
  // applied later based on the renderer type.
  const origColor = color ?? [0.52, 0.78, 0.8, 1]
  const uColor = uniform(new THREE.Vector4(origColor[0], origColor[1], origColor[2], origColor[3]))

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.NormalBlending

  material.fragmentNode = Fn(() => {
    If(frontFacing.not(), () => {
      Discard()
    })

    const pos = positionLocal
    const dis = distance(pos, uCenter)
    const per = fract(uTime)

    const adjustedPer = per.add(oneMinus(step(float(0.5), per)).mul(0.5))
    const m = adjustedPer.mul(uRadius)

    let alpha = oneMinus(dis.div(m))
    alpha = clamp(alpha, float(0), float(1))

    const inBand1 = step(m.mul(0.5), dis).mul(oneMinus(step(m.mul(0.52), dis)))
    const inBand2 = step(m.mul(0.7), dis).mul(oneMinus(step(m.mul(0.72), dis)))
    const inBands = max(inBand1, inBand2)

    const finalAlpha = mix(alpha, float(0.8), inBands)

    If(finalAlpha.lessThanEqual(float(0)), () => {
      Discard()
    })

    // The shader outputs the color directly with no extra brightness handling
    return vec4(uColor.rgb, finalAlpha)
  })()

  return { material, timeUniform: uTime, colorUniform: uColor }
}

export default class WaveCircleMesh extends THREE.Mesh {
  private animationId: number | null = null
  private readonly timeUniform: ReturnType<typeof uniform>
  private readonly colorUniform: { value: THREE.Vector4 }
  private readonly origColor: Array4

  private readonly onAdded: () => void

  constructor(options: WaveCircleMeshOptions = {}) {
    const geo = getGeometry(options.verticalAxis ?? AxisType.Y, options.radius ?? 1)
    const { material, timeUniform, colorUniform } = getMaterial(options.radius, options.color)

    super(geo, material)

    this.timeUniform = timeUniform
    this.colorUniform = colorUniform
    this.origColor = (options.color ?? [0.52, 0.78, 0.8, 1]).slice() as Array4

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

    this.startAnimate(options.speed ?? 1)
  }

  // Walk up the parent chain to find the scene the mesh belongs to
  private getScene(): THREE.Scene | null {
    return findScene(this)
  }

  // Set the color according to the renderer type; WebGPU needs sRGB brightness
  // pre-correction so it matches the WebGL output.
  private applyColor(isWebGPU: boolean): void {
    const [r, g, b, a] = this.origColor
    const value = this.colorUniform.value
    if (isWebGPU) {
      const brightness = 0.86
      value.set(
        Math.pow(r, 2.2) * brightness,
        Math.pow(g, 2.2) * brightness,
        Math.pow(b, 2.2) * brightness,
        a
      )
    } else {
      value.set(r, g, b, a)
    }
  }

  private startAnimate(speed: number) {
    const tick = () => {
      this.animationId = requestAnimationFrame(tick)
      ;(this.timeUniform as { value: number }).value += 0.005 * speed
    }

    tick()
  }

  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    this.removeEventListener('added', this.onAdded)
    this.parent?.remove(this)
    this.geometry.dispose()
    ;(this.material as NodeMaterial).dispose()
  }
}
