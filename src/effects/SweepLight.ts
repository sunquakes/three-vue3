import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
  vec4,
  positionLocal,
  varying,
  attribute,
  modelViewMatrix,
  cameraProjectionMatrix,
  abs,
  smoothstep,
  pow,
  clamp,
  max,
  min,
  mod,
  floor,
  If
} from 'three/tsl'

export interface SweepLightOptions {
  /** Sweep light color, default: 0x00ffff (cyan) */
  color?: number
  /** Sweep speed, default: 0.5 */
  speed?: number
  /** Sweep band width (0-1), default: 0.3 */
  width?: number
  /** Light intensity, default: 1.5 */
  intensity?: number
  /** Sweep direction axis: 0=X, 1=Y, 2=Z, default: 0 (X axis) */
  direction?: number
  /** Animation loop type, default: LoopRepeat */
  loop?: typeof THREE.LoopOnce | typeof THREE.LoopRepeat | typeof THREE.LoopPingPong
}

type SweepTarget = THREE.Mesh | THREE.Group | THREE.Object3D

interface SweepMaterialOptions {
  color: number
  speed: number
  width: number
  intensity: number
  direction: number
  loopType: number
}

// All sweep meshes share a single NodeMaterial so the model's meshes compile to
// one program. (A material per mesh would exhaust the WebGL2 uniform buffer
// binding points in the classic WebGLRenderer - a few dozen at most - which is
// why the sweep used to silently disappear on the WebGL renderer.) The per-mesh
// sweep range is therefore supplied through the `aSweepBounds` geometry
// attribute instead of a per-material uniform.
function createSweepMaterial(options: SweepMaterialOptions): {
  material: NodeMaterial
  timeUniform: ReturnType<typeof uniform>
  colorUniform: { value: THREE.Color }
} {
  const { color, speed, width, intensity, direction, loopType } = options

  const uTime = uniform(0)
  const uColor = uniform(new THREE.Color(color))
  const uSpeed = uniform(speed)
  const uWidth = uniform(width)
  const uIntensity = uniform(intensity)
  const uDirection = uniform(direction)
  const uLoopType = uniform(loopType)

  // Normalized sweep position (0-1) along the sweep axis, computed in the
  // vertex stage from the per-mesh aSweepBounds attribute.
  const vNormalizedPos = varying(float(0))

  const material = new NodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending
  material.side = THREE.DoubleSide

  material.vertexNode = Fn(() => {
    const aBounds = attribute<'vec2'>('aSweepBounds', 'vec2')

    // Select the position component based on the sweep axis.
    const pos = float(0).toVar()
    If(uDirection.equal(0), () => {
      pos.assign(positionLocal.x)
    })
      .ElseIf(uDirection.equal(2), () => {
        pos.assign(positionLocal.z)
      })
      .Else(() => {
        pos.assign(positionLocal.y)
      })

    const range = aBounds.y.sub(aBounds.x)
    vNormalizedPos.assign(pos.sub(aBounds.x).div(range))

    // Transform to clip space: the vertex node output must be a vec4
    // gl_Position (the WebGLNodesHandler assigns the returned node directly
    // to gl_Position), so apply the model/view/projection transforms.
    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0))
  })()

  material.fragmentNode = Fn(() => {
    const cycleTime = float(2.0).div(uSpeed)
    const t = float(0).toVar()

    If(uLoopType.equal(0), () => {
      // LoopOnce: play once and stop at end.
      t.assign(min(uTime.div(cycleTime), float(1.0)))
    })
      .ElseIf(uLoopType.equal(2), () => {
        // LoopPingPong: forward then backward.
        const cycleCount = floor(uTime.div(cycleTime))
        const cycleProgress = mod(uTime, cycleTime).div(cycleTime)
        const isForward = mod(cycleCount, float(2.0)).lessThan(float(1.0))
        t.assign(isForward.select(cycleProgress, float(1.0).sub(cycleProgress)))
      })
      .Else(() => {
        // LoopRepeat: continuous loop.
        t.assign(mod(uTime, cycleTime).div(cycleTime))
      })

    const dist = abs(vNormalizedPos.sub(t))

    const bandWidth = uWidth
    const band = pow(float(1.0).sub(smoothstep(float(0.0), bandWidth, dist)), float(1.5))

    const trailWidth = bandWidth.mul(3.0)
    const trail = pow(max(float(0.0), float(1.0).sub(dist.div(trailWidth))), float(2.0)).mul(0.4)

    const alpha = clamp(band.add(trail).mul(uIntensity), float(0.0), float(1.0))

    return vec4(uColor.rgb, alpha)
  })()

  return { material, timeUniform: uTime, colorUniform: uColor }
}

class SweepLight {
  private meshes: THREE.Mesh[] = []
  private geometries: THREE.BufferGeometry[] = []
  private material: NodeMaterial | null = null
  private timeUniform: ReturnType<typeof uniform> | null = null
  private colorUniform: { value: THREE.Color } | null = null
  private readonly origColor: THREE.Color
  private colorApplied: boolean = false
  private readonly target: SweepTarget
  private readonly onAdded: () => void
  private startTime: number
  private pausedTime: number = 0
  private isAnimating: boolean = false
  private isPaused: boolean = false
  private animationId: number | null = null

  constructor(target: SweepTarget, options: SweepLightOptions = {}) {
    this.target = target
    const {
      color = 0x00ffff,
      speed = 0.5,
      width = 0.3,
      intensity = 1.5,
      direction = 0,
      loop = THREE.LoopRepeat
    } = options

    const loopType = loop === THREE.LoopOnce ? 0 : loop === THREE.LoopPingPong ? 2 : 1

    // Collect meshes from target
    const targetMeshes: THREE.Mesh[] = []
    if ((target as THREE.Mesh).isMesh) {
      targetMeshes.push(target as THREE.Mesh)
    } else {
      target.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          targetMeshes.push(child as THREE.Mesh)
        }
      })
    }

    // Create one shared material for every sweep mesh.
    const { material, timeUniform, colorUniform } = createSweepMaterial({
      color,
      speed,
      width,
      intensity,
      direction,
      loopType
    })
    this.material = material
    this.timeUniform = timeUniform
    this.colorUniform = colorUniform
    this.origColor = new THREE.Color(color)

    // Auto-detect the renderer from the scene the target belongs to: WebGPU
    // converts linear to sRGB on final output, so pre-correct the color so it
    // matches the WebGL output. Listen for the 'added' event to cover the case
    // where SweepLight is created before the target is added to the scene.
    this.onAdded = () => {
      if (this.colorApplied || !this.colorUniform) return
      const scene = this.getScene(this.target)
      const renderer = scene?.userData?.renderer as { isWebGPURenderer?: boolean } | undefined
      if (renderer) this.applyColor(renderer.isWebGPURenderer === true)
    }
    target.addEventListener('added', this.onAdded)
    // If the target is already in the scene at construction time, the 'added'
    // event will not fire again, so check once here.
    this.onAdded()

    // Create sweep light for each mesh
    targetMeshes.forEach((mesh) => {
      mesh.updateMatrixWorld(true)
      mesh.geometry.computeBoundingBox()
      const bbox = mesh.geometry.boundingBox!

      // Sweep range along the sweep axis in LOCAL coordinates, matching the
      // positionLocal used by the shader. Slightly widen the range so the band
      // starts and ends outside the geometry.
      let minPos: number, maxPos: number
      if (direction === 0) {
        minPos = bbox.min.x
        maxPos = bbox.max.x
      } else if (direction === 2) {
        minPos = bbox.min.z
        maxPos = bbox.max.z
      } else {
        minPos = bbox.min.y
        maxPos = bbox.max.y
      }

      const range = maxPos - minPos
      minPos -= range * 0.2
      maxPos += range * 0.2

      const sweepGeometry = mesh.geometry.clone()
      // Broadcast the sweep range to every vertex: unlike a uniform, a
      // BufferAttribute is per-vertex, so a single (minPos, maxPos) value only
      // applies to vertex 0 and the rest read out-of-bounds (NaN in shaders).
      const positionCount = mesh.geometry.attributes.position.count
      const boundsArray = new Float32Array(positionCount * 2)
      for (let i = 0; i < positionCount; i++) {
        boundsArray[i * 2] = minPos
        boundsArray[i * 2 + 1] = maxPos
      }
      sweepGeometry.setAttribute('aSweepBounds', new THREE.BufferAttribute(boundsArray, 2))
      this.geometries.push(sweepGeometry)

      const sweepMesh = new THREE.Mesh(sweepGeometry, material)
      sweepMesh.renderOrder = 999
      sweepMesh.frustumCulled = false

      mesh.add(sweepMesh)

      this.meshes.push(sweepMesh)
    })

    this.startTime = performance.now()
    this.animate()
  }

  // Walk up the parent chain to find the scene an object belongs to
  private getScene(obj: THREE.Object3D): THREE.Scene | null {
    let current: THREE.Object3D | null = obj
    while (current) {
      if ((current as THREE.Scene).isScene) return current as THREE.Scene
      current = current.parent
    }
    return null
  }

  // Set the color according to the renderer type; WebGPU needs sRGB brightness
  // pre-correction so it matches the WebGL output.
  private applyColor(isWebGPU: boolean): void {
    if (!this.colorUniform) return
    this.colorApplied = true
    if (isWebGPU) {
      const { r, g, b } = this.origColor
      const brightness = 0.86
      this.colorUniform.value.setRGB(
        Math.pow(r, 2.2) * brightness,
        Math.pow(g, 2.2) * brightness,
        Math.pow(b, 2.2) * brightness
      )
    } else {
      this.colorUniform.value.copy(this.origColor)
    }
  }

  /** Internal animation loop using requestAnimationFrame */
  private animate() {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop)
      if (!this.isPaused && this.timeUniform) {
        const elapsed = (performance.now() - this.startTime) / 1000
        ;(this.timeUniform as { value: number }).value = elapsed
      }
    }
    if (!this.isAnimating) {
      this.isAnimating = true
      loop()
    }
  }

  /** Play or resume the animation */
  play() {
    if (this.isPaused) {
      // Resume: adjust startTime to account for paused duration
      this.startTime = performance.now() - this.pausedTime * 1000
      this.pausedTime = 0
      this.isPaused = false
    } else if (!this.isAnimating) {
      this.startTime = performance.now()
      this.animate()
    }
  }

  /** Pause the animation at current frame */
  pause() {
    if (this.isAnimating && !this.isPaused) {
      this.pausedTime = (performance.now() - this.startTime) / 1000
      this.isPaused = true
    }
  }

  /** Stop the animation and reset to initial state */
  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.isAnimating = false
    this.isPaused = false
    this.pausedTime = 0
    this.startTime = performance.now()
    if (this.timeUniform) {
      ;(this.timeUniform as { value: number }).value = 0
    }
  }

  /** Dispose sweep light and stop animation */
  dispose() {
    this.stop()

    this.target.removeEventListener('added', this.onAdded)

    this.meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh)
    })
    this.geometries.forEach((geometry) => {
      geometry.dispose()
    })
    this.material?.dispose()
    this.meshes = []
    this.geometries = []
    this.material = null
    this.timeUniform = null
  }
}

export default SweepLight
