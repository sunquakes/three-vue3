import * as THREE from 'three'
import type { BeachFootprintSample } from './BeachTerrain'

/** Number of footprints kept in the ring buffer. */
export const BEACH_FOOTPRINT_CAPACITY = 24

/**
 * Ring buffer of recent footsteps, uploaded as a 24x1 float texture.
 *
 * Each texel stores `(s, u, heading, birthTime)`. The sand shader walks the
 * texels and reconstructs a crisp foot shape analytically, so the trail stays
 * sharp regardless of texture resolution and fades over `BEACH_FOOTPRINT_LIFETIME`.
 */
export class BeachFootprintTrail {
  readonly texture: THREE.DataTexture
  readonly capacity: number
  private readonly data: Float32Array
  private cursor = 0
  private total = 0

  constructor(capacity = BEACH_FOOTPRINT_CAPACITY) {
    this.capacity = capacity
    this.data = new Float32Array(capacity * 4)
    for (let index = 0; index < capacity; index += 1) {
      const offset = index * 4
      this.data[offset + 1] = -1000
      this.data[offset + 3] = -1000
    }

    this.texture = new THREE.DataTexture(
      this.data,
      capacity,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    this.texture.name = 'Sandy beach footprints'
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.generateMipmaps = false
    this.texture.flipY = false
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.needsUpdate = true
  }

  add(sample: BeachFootprintSample, birthTime: number): void {
    const offset = this.cursor * 4
    this.data[offset] = sample.s
    this.data[offset + 1] = sample.u
    this.data[offset + 2] = sample.heading
    this.data[offset + 3] = birthTime
    this.cursor = (this.cursor + 1) % this.capacity
    this.total += 1
    this.texture.needsUpdate = true
  }

  /** Number of footprints written so far (saturating at the capacity). */
  get written(): number {
    return Math.min(this.total, this.capacity)
  }

  /** Copy of the texture data, mainly useful for tests. */
  snapshot(): Float32Array {
    return this.data.slice()
  }

  dispose(): void {
    this.texture.dispose()
  }
}
