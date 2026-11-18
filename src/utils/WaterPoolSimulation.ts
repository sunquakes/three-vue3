import * as THREE from 'three'

/**
 * CPU height-field simulation for the interactive water pool.
 *
 * The pool occupies the XZ square [-1, 1] and its floor is at y = -1. Each cell
 * stores the surface height and its vertical velocity together with the surface
 * normal, which is uploaded to the GPU as a half float texture. Caustics are
 * splatted from every simulated cell onto the pool floor, which keeps the
 * pattern in sync with the ripples without a second render pass.
 */
export interface WaterPoolSimulationOptions {
  /** Height-field cells per axis. */
  resolution?: number
  /** Caustic texture size per axis. */
  causticResolution?: number
  /** Velocity attenuation applied on every step. */
  damping?: number
  /** How strongly a cell is pulled towards the average of its neighbours. */
  propagation?: number
  /** Index of refraction used for the refracted sun light. */
  ior?: number
  /** Direction from the water surface towards the sun. */
  lightDirection?: THREE.Vector3 | [number, number, number]
}

export const WATER_POOL_HALF_SIZE = 1
export const WATER_POOL_FLOOR_Y = -1
export const WATER_POOL_RIM_Y = 1 / 6
export const WATER_POOL_SURFACE_Y = 0

const DEFAULT_LIGHT_DIRECTION: [number, number, number] = [0.55, 0.9, 0.35]
const MIN_RESOLUTION = 8
const MAX_RESOLUTION = 512
/** Caustic brightness of a perfectly flat surface, matching the original demo. */
const FLAT_CAUSTIC_BRIGHTNESS = 0.2

const clampResolution = (value: number) =>
  Math.min(MAX_RESOLUTION, Math.max(MIN_RESOLUTION, Math.round(value)))

/**
 * Height-field simulation with ripple propagation and caustic accumulation.
 */
export class WaterPoolSimulation {
  readonly resolution: number
  readonly causticResolution: number
  /** Surface height per cell, in world units. */
  readonly heights: Float32Array
  /** Vertical velocity per cell. */
  readonly velocities: Float32Array
  /** X component of the surface normal per cell. */
  readonly normalX: Float32Array
  /** Z component of the surface normal per cell. */
  readonly normalZ: Float32Array
  /** RGBA half float texels: height, velocity, normal.x, normal.z. */
  readonly waterTextureData: Uint16Array
  readonly waterTexture: THREE.DataTexture
  /** RGBA caustic texels, the red channel stores light intensity / 2. */
  readonly causticTextureData: Uint8Array

  private readonly nextVelocities: Float32Array
  private readonly projectedX: Float32Array
  private readonly projectedZ: Float32Array
  private readonly projectedValid: Uint8Array
  private readonly causticAccum: Float32Array
  private readonly causticScratch: Float32Array
  private readonly spacing: number
  private readonly damping: number
  private readonly propagation: number
  private readonly ior: number
  private readonly lightDirection: THREE.Vector3

  constructor(options: WaterPoolSimulationOptions = {}) {
    this.resolution = clampResolution(options.resolution ?? 128)
    this.causticResolution = clampResolution(options.causticResolution ?? this.resolution)
    this.damping = options.damping ?? 0.995
    this.propagation = options.propagation ?? 2
    this.ior = options.ior ?? 1.333

    const light = Array.isArray(options.lightDirection)
      ? new THREE.Vector3(...options.lightDirection)
      : (options.lightDirection?.clone() ?? new THREE.Vector3(...DEFAULT_LIGHT_DIRECTION))
    if (light.y <= 0) {
      light.copy(new THREE.Vector3(...DEFAULT_LIGHT_DIRECTION))
    }
    this.lightDirection = light.normalize()

    const cells = this.resolution * this.resolution
    const causticCells = this.causticResolution * this.causticResolution

    this.heights = new Float32Array(cells)
    this.velocities = new Float32Array(cells)
    this.normalX = new Float32Array(cells)
    this.normalZ = new Float32Array(cells)
    this.nextVelocities = new Float32Array(cells)
    this.projectedX = new Float32Array(cells)
    this.projectedZ = new Float32Array(cells)
    this.projectedValid = new Uint8Array(cells)
    this.causticAccum = new Float32Array(causticCells)
    this.causticScratch = new Float32Array(causticCells)

    this.waterTextureData = new Uint16Array(cells * 4)
    this.waterTexture = new THREE.DataTexture(
      this.waterTextureData,
      this.resolution,
      this.resolution,
      THREE.RGBAFormat,
      THREE.HalfFloatType
    )
    this.waterTexture.name = 'WaterPoolState'
    this.waterTexture.minFilter = THREE.LinearFilter
    this.waterTexture.magFilter = THREE.LinearFilter
    this.waterTexture.wrapS = THREE.ClampToEdgeWrapping
    this.waterTexture.wrapT = THREE.ClampToEdgeWrapping
    this.waterTexture.generateMipmaps = false
    this.waterTexture.needsUpdate = true
    this.causticTextureData = new Uint8Array(causticCells * 4)

    this.spacing = (WATER_POOL_HALF_SIZE * 2) / (this.resolution - 1)

    this.reset()
  }

  /** Clears the surface and fills the caustic texture with even lighting. */
  reset(): void {
    this.heights.fill(0)
    this.velocities.fill(0)
    this.normalX.fill(0)
    this.normalZ.fill(0)
    this.updateNormals()
    this.updateCaustics()
    this.syncWaterTexture()
    this.waterTexture.needsUpdate = true
  }

  /**
   * Adds a smooth radial displacement to the surface.
   *
   * @param x World X inside [-1, 1].
   * @param z World Z inside [-1, 1].
   * @param radius Radius of the drop in world units.
   * @param strength Peak height offset, use a negative value for a trough.
   */
  addDrop(x: number, z: number, radius = 0.06, strength = 0.01): void {
    const radiusCells = Math.max(1, (radius / (WATER_POOL_HALF_SIZE * 2)) * (this.resolution - 1))
    const centerX =
      ((x + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (this.resolution - 1)
    const centerZ =
      ((z + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (this.resolution - 1)

    const minX = Math.max(0, Math.floor(centerX - radiusCells))
    const maxX = Math.min(this.resolution - 1, Math.ceil(centerX + radiusCells))
    const minZ = Math.max(0, Math.floor(centerZ - radiusCells))
    const maxZ = Math.min(this.resolution - 1, Math.ceil(centerZ + radiusCells))

    for (let iz = minZ; iz <= maxZ; iz += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        const dx = ix - centerX
        const dz = iz - centerZ
        const distance = Math.sqrt(dx * dx + dz * dz)
        if (distance > radiusCells) {
          continue
        }
        const falloff = 0.5 - Math.cos((1 - distance / radiusCells) * Math.PI) * 0.5
        this.heights[iz * this.resolution + ix] += falloff * strength
      }
    }
  }

  /**
   * Advances the wave equation.
   *
   * @param substeps Number of simulation steps to run, matching the original
   * demo which runs two steps per rendered frame.
   */
  step(substeps = 2): void {
    const size = this.resolution
    for (let stepIndex = 0; stepIndex < substeps; stepIndex += 1) {
      for (let iz = 0; iz < size; iz += 1) {
        const row = iz * size
        const rowUp = (iz < size - 1 ? iz + 1 : iz) * size
        const rowDown = (iz > 0 ? iz - 1 : iz) * size
        for (let ix = 0; ix < size; ix += 1) {
          const index = row + ix
          const left = ix > 0 ? row + ix - 1 : row + ix
          const right = ix < size - 1 ? row + ix + 1 : row + ix
          const up = rowUp + ix
          const down = rowDown + ix

          const average =
            (this.heights[left] + this.heights[right] + this.heights[up] + this.heights[down]) *
            0.25
          const velocity =
            (this.velocities[index] + (average - this.heights[index]) * this.propagation) *
            this.damping
          this.nextVelocities[index] = velocity
        }
      }

      for (let index = 0; index < this.velocities.length; index += 1) {
        const velocity = this.nextVelocities[index]
        this.velocities[index] = velocity
        this.heights[index] += velocity
      }
    }
  }

  /** Recomputes the surface normal from the current height field. */
  updateNormals(): void {
    const size = this.resolution
    const inverseStep = 1 / (2 * this.spacing)
    for (let iz = 0; iz < size; iz += 1) {
      const row = iz * size
      const rowUp = (iz < size - 1 ? iz + 1 : iz) * size
      const rowDown = (iz > 0 ? iz - 1 : iz) * size
      for (let ix = 0; ix < size; ix += 1) {
        const index = row + ix
        const left = ix > 0 ? index - 1 : index
        const right = ix < size - 1 ? index + 1 : index
        const up = rowUp + ix
        const down = rowDown + ix

        const slopeX = (this.heights[right] - this.heights[left]) * inverseStep
        const slopeZ = (this.heights[up] - this.heights[down]) * inverseStep
        const length = Math.sqrt(slopeX * slopeX + 1 + slopeZ * slopeZ)
        this.normalX[index] = -slopeX / length
        this.normalZ[index] = -slopeZ / length
      }
    }
  }

  /**
   * Displaces the surface around a moving box, following the original
   * volume-preserving approach: restore the overlap at the old position and
   * remove it at the new one.
   */
  moveBox(oldCenter: THREE.Vector3, newCenter: THREE.Vector3, halfSize: THREE.Vector3): void {
    if (oldCenter.distanceToSquared(newCenter) < 1e-10) {
      return
    }
    const size = this.resolution
    for (let iz = 0; iz < size; iz += 1) {
      const z = -WATER_POOL_HALF_SIZE + iz * this.spacing
      for (let ix = 0; ix < size; ix += 1) {
        const x = -WATER_POOL_HALF_SIZE + ix * this.spacing
        const index = iz * size + ix
        this.heights[index] +=
          this.boxVolume(x, z, oldCenter, halfSize) - this.boxVolume(x, z, newCenter, halfSize)
      }
    }
  }

  /**
   * Projects every surface cell onto the pool floor and accumulates the
   * refracted light energy, producing moving caustic webs.
   *
   * The caustic map is indexed by surface coordinate, matching the original
   * demo: each surface cell stores how much the refracted sunlight spreads or
   * compresses, and the shaders look the map up at the surface point their own
   * refracted sun ray came from.
   */
  updateCaustics(): void {
    const size = this.resolution
    const accum = this.causticAccum
    accum.fill(0)

    // Refracted sun light inside the water, computed for a flat surface first.
    const light = this.lightDirection
    const eta = 1 / this.ior
    const flatCos = -light.y
    const flatK = 1 - eta * eta * (1 - flatCos * flatCos)
    if (flatK <= 0) {
      this.fillCaustics(accum)
      return
    }

    const valid = this.projectedValid
    valid.fill(0)

    // First pass: project each surface cell along its own refracted sun ray.
    for (let iz = 0; iz < size; iz += 1) {
      const z = -WATER_POOL_HALF_SIZE + iz * this.spacing
      for (let ix = 0; ix < size; ix += 1) {
        const index = iz * size + ix
        const nx = this.normalX[index]
        const nz = this.normalZ[index]
        const ny = Math.sqrt(Math.max(1 - nx * nx - nz * nz, 0.0001))
        const cosI = -(nx * light.x + ny * light.y + nz * light.z)
        const k = 1 - eta * eta * (1 - cosI * cosI)
        if (k <= 0) {
          continue
        }
        const scale = eta * cosI + Math.sqrt(k)
        const rayX = -eta * light.x - scale * nx
        const rayY = -eta * light.y - scale * ny
        const rayZ = -eta * light.z - scale * nz
        if (rayY >= -1e-4) {
          continue
        }

        const x = -WATER_POOL_HALF_SIZE + ix * this.spacing
        const distance = (WATER_POOL_FLOOR_Y - this.heights[index]) / rayY
        this.projectedX[index] = x + rayX * distance
        this.projectedZ[index] = z + rayZ * distance
        valid[index] = 1
      }
    }

    // Second pass: the flat projection is affine, so its cell area is exactly
    // one cell of the grid. Any local compression of the perturbed projection
    // concentrates light, which becomes the caustic brightness.
    const flatArea = this.spacing * this.spacing
    for (let iz = 0; iz < size; iz += 1) {
      const row = iz * size
      const rowUp = Math.min(size - 1, iz + 1) * size
      const rowDown = Math.max(0, iz - 1) * size
      for (let ix = 0; ix < size; ix += 1) {
        const index = row + ix
        if (valid[index] === 0) {
          continue
        }
        const left = row + Math.max(0, ix - 1)
        const right = row + Math.min(size - 1, ix + 1)
        const up = rowUp + ix
        const down = rowDown + ix
        if (valid[left] === 0 || valid[right] === 0 || valid[up] === 0 || valid[down] === 0) {
          continue
        }

        const derivativeX = (this.projectedX[right] - this.projectedX[left]) * 0.5
        const derivativeZ = (this.projectedZ[up] - this.projectedZ[down]) * 0.5
        const crossX = (this.projectedX[up] - this.projectedX[down]) * 0.5
        const crossZ = (this.projectedZ[right] - this.projectedZ[left]) * 0.5
        const area = Math.abs(derivativeX * derivativeZ - crossX * crossZ)
        const compression = Math.min(12, Math.max(0.06, flatArea / Math.max(area, 1e-8)))

        this.splatCaustic(
          -WATER_POOL_HALF_SIZE + ix * this.spacing,
          -WATER_POOL_HALF_SIZE + iz * this.spacing,
          compression * FLAT_CAUSTIC_BRIGHTNESS
        )
      }
    }

    this.blurCaustics()
    this.fillCaustics(accum)
  }

  /** Uploads the current height field and caustics. */
  updateTexture(): void {
    this.updateCaustics()
    this.syncWaterTexture()
    this.waterTexture.needsUpdate = true
  }

  /** Copies the current state into the packed half float texture. */
  syncWaterTexture(): void {
    const data = this.waterTextureData
    for (let index = 0; index < this.heights.length; index += 1) {
      const offset = index * 4
      data[offset] = THREE.DataUtils.toHalfFloat(this.heights[index])
      data[offset + 1] = THREE.DataUtils.toHalfFloat(this.velocities[index])
      data[offset + 2] = THREE.DataUtils.toHalfFloat(this.normalX[index])
      data[offset + 3] = THREE.DataUtils.toHalfFloat(this.normalZ[index])
    }
  }

  dispose(): void {
    this.waterTexture.dispose()
  }

  /** Reads the surface height at a world position, used by tests and tooling. */
  getHeightAt(x: number, z: number): number {
    const ix = Math.round(
      ((x + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (this.resolution - 1)
    )
    const iz = Math.round(
      ((z + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (this.resolution - 1)
    )
    const clampedX = Math.min(this.resolution - 1, Math.max(0, ix))
    const clampedZ = Math.min(this.resolution - 1, Math.max(0, iz))
    return this.heights[clampedZ * this.resolution + clampedX]
  }

  /**
   * Water displaced by a box column. A box that floats entirely above the
   * surface does not push any water, while a submerged box raises the surface
   * by a smoothed version of its own height so the edges stay aliasing free.
   */
  private boxVolume(x: number, z: number, center: THREE.Vector3, halfSize: THREE.Vector3): number {
    if (center.y - halfSize.y > WATER_POOL_SURFACE_Y) {
      return 0
    }
    const margin = 0.06
    const outsideX = Math.abs(x - center.x) - halfSize.x
    const outsideZ = Math.abs(z - center.z) - halfSize.z
    const outside = Math.max(outsideX, outsideZ)
    if (outside >= margin) {
      return 0
    }
    const falloff = 1 - Math.max(0, outside) / margin
    const smooth = falloff * falloff * (3 - 2 * falloff)
    return Math.min(0.2, halfSize.y * 0.9) * smooth
  }

  private splatCaustic(x: number, z: number, weight: number): void {
    const size = this.causticResolution
    const gridX = ((x + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (size - 1)
    const gridZ = ((z + WATER_POOL_HALF_SIZE) / (WATER_POOL_HALF_SIZE * 2)) * (size - 1)
    if (gridX < 0 || gridZ < 0 || gridX > size - 1 || gridZ > size - 1) {
      return
    }
    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(size - 1, x0 + 1)
    const z1 = Math.min(size - 1, z0 + 1)
    const fx = gridX - x0
    const fz = gridZ - z0

    this.causticAccum[z0 * size + x0] += weight * (1 - fx) * (1 - fz)
    this.causticAccum[z0 * size + x1] += weight * fx * (1 - fz)
    this.causticAccum[z1 * size + x0] += weight * (1 - fx) * fz
    this.causticAccum[z1 * size + x1] += weight * fx * fz
  }

  private blurCaustics(): void {
    const size = this.causticResolution
    const source = this.causticAccum
    const target = this.causticScratch

    // Horizontal pass.
    for (let iz = 0; iz < size; iz += 1) {
      const row = iz * size
      for (let ix = 0; ix < size; ix += 1) {
        const left = row + Math.max(0, ix - 1)
        const right = row + Math.min(size - 1, ix + 1)
        target[row + ix] = source[left] * 0.25 + source[row + ix] * 0.5 + source[right] * 0.25
      }
    }

    // Vertical pass.
    for (let iz = 0; iz < size; iz += 1) {
      const row = iz * size
      const rowUp = Math.min(size - 1, iz + 1) * size
      const rowDown = Math.max(0, iz - 1) * size
      for (let ix = 0; ix < size; ix += 1) {
        source[row + ix] =
          target[rowDown + ix] * 0.25 + target[row + ix] * 0.5 + target[rowUp + ix] * 0.25
      }
    }
  }

  private fillCaustics(values: Float32Array): void {
    const data = this.causticTextureData
    for (let index = 0; index < values.length; index += 1) {
      // Caustic intensity is stored directly; saturated pixels simply clip.
      const value = Math.min(1, Math.max(0, values[index]))
      const byte = Math.round(value * 255)
      const offset = index * 4
      data[offset] = byte
      data[offset + 1] = byte
      data[offset + 2] = byte
      data[offset + 3] = 255
    }
  }
}
