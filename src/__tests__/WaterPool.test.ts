import * as THREE from 'three'
import { uniform } from 'three/tsl'
import { describe, expect, it, vi } from 'vitest'
import {
  WATER_POOL_FLOOR_Y,
  WATER_POOL_HALF_SIZE,
  WaterPoolSimulation
} from '../utils/WaterPoolSimulation'
import { createWaterPoolMaterials } from '../utils/WaterPoolMaterials'
import {
  WATER_POOL_BOX_OUTLINE,
  clampToWaterPool,
  convexHull2D,
  createWaterPoolEdges,
  getWaterPoolBounds,
  isInsideWaterPool,
  resolveWaterPoolShape,
  sampleWaterPoolOutline,
  WATER_POOL_IRREGULAR_CUBE_OUTLINE
} from '../utils/WaterPoolShape'

const createSimulation = () =>
  new WaterPoolSimulation({
    resolution: 32,
    causticResolution: 32,
    lightDirection: [0.55, 0.9, 0.35]
  })

const causticBytes = (simulation: WaterPoolSimulation) => {
  const values: number[] = []
  for (let index = 0; index < simulation.causticTextureData.length; index += 4) {
    values.push(simulation.causticTextureData[index])
  }
  return values
}

describe('WaterPoolSimulation', () => {
  it('starts from a flat surface with even caustic lighting', () => {
    const simulation = createSimulation()

    expect(simulation.heights.every((value) => value === 0)).toBe(true)
    expect(simulation.velocities.every((value) => value === 0)).toBe(true)
    expect(simulation.normalX.every((value) => value === 0)).toBe(true)
    expect(simulation.normalZ.every((value) => value === 0)).toBe(true)

    // A flat surface refracts the sunlight without compression, which leaves
    // the baseline brightness in the caustic map (0.2 -> about 51 / 255).
    const bytes = causticBytes(simulation)
    const average = bytes.reduce((sum, value) => sum + value, 0) / bytes.length
    expect(average).toBeGreaterThan(44)
    expect(average).toBeLessThan(60)
  })

  it('uses the reference water texture sampling settings', () => {
    const simulation = createSimulation()

    expect(simulation.waterTexture.name).toBe('WaterPoolState')
    expect(simulation.waterTexture.minFilter).toBe(THREE.LinearFilter)
    expect(simulation.waterTexture.magFilter).toBe(THREE.LinearFilter)
    expect(simulation.waterTexture.wrapS).toBe(THREE.ClampToEdgeWrapping)
    expect(simulation.waterTexture.wrapT).toBe(THREE.ClampToEdgeWrapping)
    expect(simulation.waterTexture.generateMipmaps).toBe(false)

    simulation.dispose()
  })

  it('disposes the GPU texture it owns', () => {
    const simulation = createSimulation()
    const onDispose = vi.fn()
    simulation.waterTexture.addEventListener('dispose', onDispose)

    simulation.dispose()

    expect(onDispose).toHaveBeenCalledTimes(1)
  })

  it('raises the surface around a drop and propagates it to neighbours', () => {
    const simulation = createSimulation()

    simulation.addDrop(0, 0, 0.1, 0.02)
    expect(simulation.getHeightAt(0, 0)).toBeGreaterThan(0)
    expect(simulation.getHeightAt(0.9, 0.9)).toBe(0)

    simulation.step(2)
    simulation.updateNormals()

    expect(simulation.getHeightAt(0, 0)).not.toBe(0)
    const nearCentre = simulation.getHeightAt(0.15, 0)
    expect(Number.isFinite(nearCentre)).toBe(true)
    expect(Math.abs(nearCentre)).toBeGreaterThan(0)
  })

  it('keeps the height field finite and bounded while stepping', () => {
    const simulation = createSimulation()
    simulation.addDrop(0.2, -0.4, 0.08, 0.02)

    for (let frame = 0; frame < 120; frame += 1) {
      simulation.step(2)
    }
    simulation.updateNormals()

    expect(simulation.heights.every(Number.isFinite)).toBe(true)
    expect(simulation.velocities.every(Number.isFinite)).toBe(true)
    expect(simulation.normalX.every(Number.isFinite)).toBe(true)
    expect(simulation.normalZ.every(Number.isFinite)).toBe(true)

    const maxHeight = Math.max(...simulation.heights)
    expect(maxHeight).toBeLessThan(0.5)
  })

  it('builds unit length normals from the height field', () => {
    const simulation = createSimulation()
    simulation.addDrop(0.1, 0.1, 0.12, 0.03)
    simulation.updateNormals()

    let tilted = 0
    for (let index = 0; index < simulation.heights.length; index += 1) {
      const nx = simulation.normalX[index]
      const nz = simulation.normalZ[index]
      expect(Number.isFinite(nx)).toBe(true)
      expect(Number.isFinite(nz)).toBe(true)
      expect(nx * nx + nz * nz).toBeLessThanOrEqual(1.000001)
      if (Math.abs(nx) + Math.abs(nz) > 1e-4) {
        tilted += 1
      }
    }
    expect(tilted).toBeGreaterThan(0)
  })

  it('displaces the surface when a box moves', () => {
    const simulation = createSimulation()
    const oldCenter = new THREE.Vector3(-0.4, -0.75, 0.2)
    const newCenter = oldCenter.clone().add(new THREE.Vector3(0.2, 0.1, 0))
    const halfSize = new THREE.Vector3(0.18, 0.18, 0.18)

    simulation.moveBox(oldCenter, newCenter, halfSize)

    expect(simulation.heights.some((value) => Math.abs(value) > 1e-6)).toBe(true)
    expect(simulation.heights.every(Number.isFinite)).toBe(true)
    expect(WATER_POOL_FLOOR_Y).toBe(-1)
    expect(WATER_POOL_HALF_SIZE).toBe(1)
  })

  it('ignores boxes that float entirely above the surface', () => {
    const simulation = createSimulation()
    const oldCenter = new THREE.Vector3(-0.4, 0.8, 0.2)
    const newCenter = oldCenter.clone().add(new THREE.Vector3(0.2, 0, 0))

    simulation.moveBox(oldCenter, newCenter, new THREE.Vector3(0.1, 0.1, 0.1))

    expect(simulation.heights.every((value) => value === 0)).toBe(true)
  })

  it('concentrates caustic light into brighter filaments for ripples', () => {
    const simulation = createSimulation()
    const flatBytes = causticBytes(simulation)
    const flatMax = Math.max(...flatBytes)

    simulation.addDrop(0.1, -0.2, 0.2, 0.05)
    for (let frame = 0; frame < 20; frame += 1) {
      simulation.step(2)
    }
    simulation.updateNormals()
    simulation.updateCaustics()

    const rippleBytes = causticBytes(simulation)
    const rippleMax = Math.max(...rippleBytes)
    const rippleMin = Math.min(...rippleBytes)

    expect(rippleMax).toBeGreaterThan(flatMax)
    expect(rippleMax - rippleMin).toBeGreaterThan(4)
  })

  it('packs the water state into half float RGBA texels', () => {
    const simulation = createSimulation()
    simulation.addDrop(0.3, 0.3, 0.1, 0.02)
    simulation.step(2)
    simulation.updateNormals()
    simulation.syncWaterTexture()

    const data = simulation.waterTextureData
    expect(data.length).toBe(simulation.resolution * simulation.resolution * 4)

    const halfFloat = THREE.DataUtils.fromHalfFloat(data[0])
    expect(halfFloat).toBeCloseTo(simulation.heights[0], 3)

    // Every texel must decode to a finite value.
    for (let index = 0; index < data.length; index += 1) {
      expect(Number.isFinite(THREE.DataUtils.fromHalfFloat(data[index]))).toBe(true)
    }
  })
})

describe('WaterPoolShape', () => {
  it('keeps the built-in outlines convex', () => {
    ;[WATER_POOL_BOX_OUTLINE, WATER_POOL_IRREGULAR_CUBE_OUTLINE].forEach((outline) => {
      outline.forEach((start, index) => {
        const middle = outline[(index + 1) % outline.length]
        const end = outline[(index + 2) % outline.length]
        const cross =
          (middle[0] - start[0]) * (end[1] - middle[1]) -
          (middle[1] - start[1]) * (end[0] - middle[0])

        expect(cross).toBeGreaterThan(0)
        expect(isInsideWaterPool(0, 0, createWaterPoolEdges(outline))).toBe(true)
      })
    })
  })

  it('reduces unordered and duplicate outline points to their convex hull', () => {
    const hull = convexHull2D([
      [1, 1],
      [-1, -1],
      [1, -1],
      [0, 0],
      [-1, 1],
      [1, 1]
    ])

    expect(hull).toEqual(WATER_POOL_BOX_OUTLINE)
    expect(getWaterPoolBounds(hull)).toEqual({ minX: -1, maxX: 1, minZ: -1, maxZ: 1 })
  })

  it('resolves built-in, custom and geometry-based container shapes', () => {
    expect(resolveWaterPoolShape('box')).toEqual(WATER_POOL_BOX_OUTLINE)
    expect(resolveWaterPoolShape()).toEqual(WATER_POOL_IRREGULAR_CUBE_OUTLINE)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-0.8, 0, -0.6, 0.7, 0.2, -0.5, 0.5, -0.1, 0.8, -0.6, 0.3, 0.7, 0, 0.5, 0],
        3
      )
    )
    expect(resolveWaterPoolShape(geometry)).toHaveLength(4)
  })

  it('rejects outlines that do not bound a normalized pool around the origin', () => {
    expect(() =>
      resolveWaterPoolShape([
        [0, 0],
        [1, 0]
      ])
    ).toThrow()
    expect(() =>
      resolveWaterPoolShape([
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8]
      ])
    ).toThrow()
    expect(() =>
      resolveWaterPoolShape([
        [-2, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ])
    ).toThrow()
  })

  it('tells inside points from points outside the basin', () => {
    const edges = createWaterPoolEdges(WATER_POOL_IRREGULAR_CUBE_OUTLINE)
    expect(isInsideWaterPool(0, 0, edges)).toBe(true)
    expect(isInsideWaterPool(0.95, 0.95, edges)).toBe(false)
    expect(isInsideWaterPool(-0.99, 0.1, edges)).toBe(false)
  })

  it('pushes dragged boxes back inside the outline', () => {
    const edges = createWaterPoolEdges(WATER_POOL_IRREGULAR_CUBE_OUTLINE)
    const [x, z] = clampToWaterPool(0.95, 0.95, edges, 0.1)

    expect(isInsideWaterPool(x, z, edges, 0.099)).toBe(true)
  })

  it('samples the outline as a closed ring on the boundary', () => {
    const points = sampleWaterPoolOutline(WATER_POOL_IRREGULAR_CUBE_OUTLINE, 3)
    const edges = createWaterPoolEdges(WATER_POOL_IRREGULAR_CUBE_OUTLINE)

    expect(points).toHaveLength(WATER_POOL_IRREGULAR_CUBE_OUTLINE.length * 3)
    points.forEach(([x, z]) => {
      expect(isInsideWaterPool(x, z, edges, -1e-4)).toBe(true)
    })
  })
})

describe('WaterPoolMaterials', () => {
  const createMaterials = () => {
    const waterTexture = new THREE.DataTexture(
      new Uint16Array(4 * 4 * 4),
      4,
      4,
      THREE.RGBAFormat,
      THREE.HalfFloatType
    )
    const materials = createWaterPoolMaterials({
      waterTexture,
      lightDirection: uniform(new THREE.Vector3(0.55, 0.9, 0.35).normalize()),
      poolCenter: uniform(new THREE.Vector3(2, 3, -1)),
      poolScale: uniform(2.5)
    })

    return {
      materials,
      dispose: () => {
        materials.water.dispose()
        waterTexture.dispose()
      }
    }
  }

  it('builds the single analytic, double-sided water surface', () => {
    const { materials, dispose } = createMaterials()

    expect(Object.keys(materials)).toEqual(['water'])
    expect(materials.water.name).toBe('WaterPoolSurface')
    expect(materials.water.positionNode).toBeDefined()
    expect(materials.water.colorNode).toBeDefined()
    expect(materials.water.side).toBe(THREE.DoubleSide)

    dispose()
  })
})
