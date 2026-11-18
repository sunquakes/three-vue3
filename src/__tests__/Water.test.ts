import * as THREE from 'three'
import { uniform, vec3 } from 'three/tsl'
import { describe, expect, it } from 'vitest'
import { createWaterMaterial } from '../utils/WaterMaterial'
import { createNoiseTexture, NOISE_TEXTURE_SIZE } from '../utils/WaterNoise'
import { updateMirrorCamera } from '../utils/WaterReflection'
import { OCEAN_WAVES, sampleOceanSurface } from '../utils/WaterSpectrum'
import { resolveWaterPoolShape, sampleWaterPoolOutline } from '../utils/WaterPoolShape'
import {
  createWaterSurfaceGeometry,
  getWaterOutlineSubdivisions,
  resolveWaterSurfaceShape
} from '../utils/WaterSurfaceGeometry'

describe('WaterSpectrum', () => {
  it('defines a directional spectrum with normalized wave directions', () => {
    expect(OCEAN_WAVES.length).toBeGreaterThanOrEqual(14)

    OCEAN_WAVES.forEach((wave) => {
      expect(wave.direction.length()).toBeCloseTo(1, 6)
      expect(wave.wavelength).toBeGreaterThan(0)
      expect(wave.steepness).toBeGreaterThan(0)
      expect(wave.lodEnd).toBeGreaterThan(wave.lodStart)
    })
  })

  it('samples a finite surface with upward facing normals', () => {
    const times = [0, 1.7, 12.5, 240]
    const positions = [-210, -60, 0, 45, 209]

    times.forEach((time) => {
      positions.forEach((x) => {
        positions.forEach((z) => {
          const sample = sampleOceanSurface(x, z, time)

          expect(Number.isFinite(sample.height)).toBe(true)
          expect(Number.isFinite(sample.normal.x)).toBe(true)
          expect(Number.isFinite(sample.normal.y)).toBe(true)
          expect(Number.isFinite(sample.normal.z)).toBe(true)
          // The surface normal always points away from the water body.
          expect(sample.normal.y).toBeGreaterThan(0)
          expect(sample.normal.length()).toBeCloseTo(1, 6)
        })
      })
    })
  })

  it('keeps the wave height within the summed amplitude budget', () => {
    // Each mode is bounded by its amplitude and the packet envelope, so the
    // surface can never exceed twice the linear amplitude sum.
    const amplitudeSum = OCEAN_WAVES.reduce(
      (sum, wave) => sum + (wave.steepness * wave.wavelength) / (Math.PI * 2),
      0
    )
    const limit = amplitudeSum * 2 * 1.6

    for (let index = 0; index < 40; index += 1) {
      const time = index * 0.7
      const sample = sampleOceanSurface(Math.cos(index) * 180, Math.sin(index * 1.7) * 180, time)
      expect(Math.abs(sample.height)).toBeLessThan(limit)
    }
  })

  it('is deterministic for identical inputs and varies with time and position', () => {
    const base = sampleOceanSurface(12.5, -8.25, 3.5)
    const repeated = sampleOceanSurface(12.5, -8.25, 3.5)
    const laterInTime = sampleOceanSurface(12.5, -8.25, 4.5)
    const elsewhere = sampleOceanSurface(25, -8.25, 3.5)

    expect(repeated.height).toBe(base.height)
    expect(repeated.normal.equals(base.normal)).toBe(true)
    expect(laterInTime.height).not.toBe(base.height)
    expect(elsewhere.height).not.toBe(base.height)
  })
})

describe('WaterNoise', () => {
  it('creates a repeatable grayscale noise map', () => {
    const texture = createNoiseTexture()

    expect(texture.image.width).toBe(NOISE_TEXTURE_SIZE)
    expect(texture.image.height).toBe(NOISE_TEXTURE_SIZE)
    const data = (texture.image as { data: Uint8Array }).data
    expect(data.length).toBe(NOISE_TEXTURE_SIZE * NOISE_TEXTURE_SIZE * 4)
    expect(texture.wrapS).toBe(THREE.RepeatWrapping)
    expect(texture.wrapT).toBe(THREE.RepeatWrapping)
    expect(texture.colorSpace).toBe(THREE.NoColorSpace)
    expect(texture.generateMipmaps).toBe(true)

    const uniqueBytes = new Set(Array.from(data.slice(0, 4096)))
    expect(uniqueBytes.size).toBeGreaterThan(32)

    texture.dispose()
  })
})

describe('WaterMaterial', () => {
  it('builds a water material graph from the shared spectrum', () => {
    const noiseMap = createNoiseTexture()
    const material = createWaterMaterial({
      timeNode: uniform(0),
      underwaterNode: uniform(0),
      noiseMap,
      sunDirection: uniform(new THREE.Vector3(0, 1, 0)),
      samplers: {
        sampleReflection: () => vec3(0),
        sampleRefraction: () => vec3(0)
      }
    })

    expect(material.name).toBe('Water')
    expect(material.positionNode).toBeDefined()
    expect(material.colorNode).toBeDefined()
    expect(material.side).toBe(THREE.DoubleSide)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)

    material.dispose()
    noiseMap.dispose()
  })
})

describe('WaterReflection', () => {
  const createFixture = () => {
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial())
    mirror.rotation.x = -Math.PI / 2
    mirror.updateMatrixWorld(true)

    const camera = new THREE.PerspectiveCamera(51, 1, 0.08, 520)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)

    const mirrorCamera = camera.clone()

    return { mirror, camera, mirrorCamera }
  }

  it('mirrors the camera across the water plane', () => {
    const { mirror, camera, mirrorCamera } = createFixture()

    expect(updateMirrorCamera(camera, mirror, mirrorCamera)).toBe(true)
    expect(mirrorCamera.position.x).toBeCloseTo(camera.position.x, 5)
    expect(mirrorCamera.position.y).toBeCloseTo(-camera.position.y, 5)
    expect(mirrorCamera.position.z).toBeCloseTo(camera.position.z, 5)
  })

  it('projects the scene into the flipped screen space the shader samples', () => {
    const { mirror, camera, mirrorCamera } = createFixture()
    updateMirrorCamera(camera, mirror, mirrorCamera)

    const points = [
      new THREE.Vector3(1, 1.5, -2),
      new THREE.Vector3(-3, 0.8, -12),
      new THREE.Vector3(4, 2.4, -30)
    ]

    points.forEach((point) => {
      // A mirrored point seen through the main camera lands exactly where the
      // reflected camera draws the original point, with the horizontal axis
      // flipped because the reflected up vector mirrors the camera basis.
      const mirroredNdc = point.clone().project(mirrorCamera)
      const expectedNdc = point.clone().setY(-point.y).project(camera)

      expect(mirroredNdc.x).toBeCloseTo(-expectedNdc.x, 4)
      expect(mirroredNdc.y).toBeCloseTo(expectedNdc.y, 4)
    })
  })

  it('skips the capture when the plane faces away from the camera', () => {
    const { mirror, camera, mirrorCamera } = createFixture()
    camera.position.set(0, -1.5, 1.2)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)

    expect(updateMirrorCamera(camera, mirror, mirrorCamera)).toBe(false)
  })
})

describe('WaterSurfaceGeometry', () => {
  const outline = resolveWaterPoolShape([
    [-1, -0.5],
    [1, -0.5],
    [1, 0.5],
    [-1, 0.5]
  ])

  it('spreads the boundary subdivision budget across all outline edges', () => {
    expect(getWaterOutlineSubdivisions(160, outline)).toBe(40)
    expect(getWaterOutlineSubdivisions(3, outline)).toBe(1)
    expect(sampleWaterPoolOutline(outline, 40)).toHaveLength(160)
  })

  it('builds concentric rings with upward winding and an exact custom boundary', () => {
    const geometry = createWaterSurfaceGeometry(16, outline)
    const positions = geometry.getAttribute('position')
    const indices = geometry.getIndex()
    const boundary = sampleWaterPoolOutline(outline, 4)
    const angular = boundary.length
    const rings = Math.max(8, Math.round(16 / 4))

    expect(positions.count).toBe(1 + angular * rings)
    expect(indices).not.toBeNull()
    expect(indices!.count % 3).toBe(0)
    expect(positions.getX(0)).toBe(0)
    expect(positions.getY(0)).toBe(0)
    expect(positions.getZ(0)).toBe(0)

    // The outer ring contains the outline vertices, preserving straight edges
    // instead of approximating the custom shape with a rectangular plane.
    const outerRing = 1 + (rings - 1) * angular
    boundary.forEach(([x, z], index) => {
      expect(positions.getX(outerRing + index)).toBeCloseTo(x, 6)
      expect(positions.getY(outerRing + index)).toBe(0)
      expect(positions.getZ(outerRing + index)).toBeCloseTo(z, 6)
    })

    for (let triangle = 0; triangle < indices!.count; triangle += 3) {
      const a = indices!.getX(triangle)
      const b = indices!.getX(triangle + 1)
      const c = indices!.getX(triangle + 2)
      const abx = positions.getX(b) - positions.getX(a)
      const abz = positions.getZ(b) - positions.getZ(a)
      const acx = positions.getX(c) - positions.getX(a)
      const acz = positions.getZ(c) - positions.getZ(a)
      // XZ cross products with this sign produce a +Y geometric normal.
      expect(abz * acx - abx * acz).toBeGreaterThan(0)
    }
  })

  it('accepts world-unit Water outlines without relaxing normalized WaterPool shapes', () => {
    const worldOutline = resolveWaterSurfaceShape([
      [-8, -2.5],
      [-4.5, -5.5],
      [1.5, -6],
      [6.5, -3.5],
      [8, 1],
      [4.5, 5],
      [-1.5, 5.5],
      [-6.5, 3]
    ])
    const geometry = createWaterSurfaceGeometry(160, worldOutline)
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!

    expect(bounds.min.x).toBeCloseTo(-8, 6)
    expect(bounds.max.x).toBeCloseTo(8, 6)
    expect(bounds.min.z).toBeCloseTo(-6, 6)
    expect(bounds.max.z).toBeCloseTo(5.5, 6)
    expect(() => resolveWaterPoolShape(worldOutline)).toThrow('inside -1…1')

    geometry.dispose()
  })
})
