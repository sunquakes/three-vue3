import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  clamp,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  positionWorld,
  smoothstep,
  transformNormal,
  uniform,
  varying,
  vec3
} from 'three/tsl'

export interface SnowCoverOptions {
  scene: THREE.Scene
  targets?: THREE.Object3D | THREE.Object3D[]
  thickness?: number
  duration?: number
  color?: THREE.ColorRepresentation
  renderer?: { isWebGPURenderer?: boolean } | null
}

const DEFAULT_THICKNESS = 0.1
const DEFAULT_DURATION = 6
const SCAN_INTERVAL = 0.5

/**
 * Adds a snow shell to every eligible target mesh and grows it over time.
 */
export class SnowCover {
  readonly material: MeshBasicNodeMaterial
  private readonly scene: THREE.Scene
  private readonly targets: THREE.Object3D[] | null
  private readonly duration: number
  private readonly progress: ReturnType<typeof createSnowCoverMaterial>['progress']
  private readonly shells = new Map<THREE.Mesh, THREE.Mesh>()
  private scanElapsed = 0
  private disposed = false

  constructor({
    scene,
    targets,
    thickness = DEFAULT_THICKNESS,
    duration = DEFAULT_DURATION,
    color = 0xffffff,
    renderer
  }: SnowCoverOptions) {
    this.scene = scene
    this.targets = targets ? (Array.isArray(targets) ? targets : [targets]) : null
    this.duration = Math.max(duration, 0.001)
    const { material, progress } = createSnowCoverMaterial(thickness, color, renderer)
    this.material = material
    this.progress = progress
    this.refreshTargets()
  }

  get value(): number {
    return this.progress.value as number
  }

  update(delta: number): void {
    if (this.disposed) return

    if (this.progress.value < 1) {
      this.progress.value = Math.min(1, (this.progress.value as number) + delta / this.duration)
    }

    if (!this.targets) {
      this.scanElapsed += delta
      if (this.scanElapsed >= SCAN_INTERVAL) {
        this.scanElapsed = 0
        this.refreshTargets()
      }
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.shells.forEach((shell) => shell.removeFromParent())
    this.shells.clear()
    this.material.dispose()
  }

  private refreshTargets(): void {
    if (this.targets) {
      this.targets.forEach((target) => target.traverse((object) => this.attach(object)))
      return
    }

    this.scene.traverse((object) => this.attach(object))
  }

  private attach(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.isSnowCover || this.shells.has(mesh)) return
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) return
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return
    if (!mesh.visible || !mesh.geometry) return
    if (!mesh.geometry.getAttribute('normal')) return

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (materials.some((material) => !material || material.side === THREE.BackSide)) {
      return
    }
    if (materials.some((material) => material.transparent)) return

    const shell = new THREE.Mesh(mesh.geometry, this.material)
    shell.name = 'SnowCover'
    shell.userData.isSnowCover = true
    shell.raycast = () => {}
    mesh.add(shell)
    this.shells.set(mesh, shell)
  }
}

function createSnowCoverMaterial(
  thickness: number,
  color: THREE.ColorRepresentation,
  renderer?: { isWebGPURenderer?: boolean } | null
) {
  const progress = uniform(0)
  const uThickness = uniform(thickness)
  const uColor = uniform(new THREE.Color(color))

  if (renderer?.isWebGPURenderer === true) {
    const brightness = 0.86
    const { r, g, b } = uColor.value
    uColor.value.setRGB(
      Math.pow(r, 2.2) * brightness,
      Math.pow(g, 2.2) * brightness,
      Math.pow(b, 2.2) * brightness
    )
  }

  const threshold = mix(0.99, 0.35, progress)
  const softness = 0.18
  const worldNormal = transformNormal(normalLocal, modelWorldMatrix).normalize()
  const coverNormal = varying(worldNormal, 'vSnowCoverNormal')

  const material = new MeshBasicNodeMaterial()
  material.name = 'SnowCover'
  material.transparent = true
  material.depthWrite = true
  material.alphaTest = 0.01
  material.side = THREE.FrontSide
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1

  material.positionNode = Fn(() => {
    const coverage = smoothstep(threshold, threshold.add(softness), worldNormal.y)
    return positionLocal.add(normalLocal.mul(uThickness.mul(progress).mul(coverage)))
  })()

  material.colorNode = Fn(() => {
    const up = clamp(coverNormal.y, 0, 1)
    return uColor.rgb.mul(mix(vec3(0.72, 0.78, 0.9), vec3(1), up))
  })()

  material.opacityNode = Fn(() => {
    const grain = mx_noise_float(positionWorld.mul(1.7))
    return smoothstep(threshold, threshold.add(softness), coverNormal.y.add(grain.mul(0.25)))
  })()

  return { material, progress }
}
