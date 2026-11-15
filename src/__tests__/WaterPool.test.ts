import * as THREE from 'three'
import { uniform } from 'three/tsl'
import { describe, expect, it } from 'vitest'
import {
  WATER_POOL_FLOOR_Y,
  WATER_POOL_HALF_SIZE,
  WaterPoolSimulation
} from '../utils/WaterPoolSimulation'
import { createWaterPoolMaterials } from '../utils/WaterPoolMaterials'
import {
  WATER_POOL_OUTLINE,
  clampToWaterPool,
  isInsideWaterPool,
  sampleWaterPoolOutline
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
  it('keeps the irregular outline convex', () => {
    WATER_POOL_OUTLINE.forEach((start, index) => {
      const middle = WATER_POOL_OUTLINE[(index + 1) % WATER_POOL_OUTLINE.length]
      const end = WATER_POOL_OUTLINE[(index + 2) % WATER_POOL_OUTLINE.length]
      const cross =
        (middle[0] - start[0]) * (end[1] - middle[1]) -
        (middle[1] - start[1]) * (end[0] - middle[0])

      expect(cross).toBeGreaterThan(0)
    })
  })

  it('tells inside points from points outside the basin', () => {
    expect(isInsideWaterPool(0, 0)).toBe(true)
    expect(isInsideWaterPool(0.95, 0.95)).toBe(false)
    expect(isInsideWaterPool(-0.9, 0.1)).toBe(false)
  })

  it('pushes dragged boxes back inside the outline', () => {
    const [x, z] = clampToWaterPool(0.95, 0.95, 0.1)

    expect(isInsideWaterPool(x, z, 0.099)).toBe(true)
  })

  it('samples the outline as a closed ring on the boundary', () => {
    const points = sampleWaterPoolOutline(3)

    expect(points).toHaveLength(WATER_POOL_OUTLINE.length * 3)
    points.forEach(([x, z]) => {
      expect(isInsideWaterPool(x, z, -1e-4)).toBe(true)
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
    const causticTexture = new THREE.DataTexture(
      new Uint8Array(4 * 4 * 4),
      4,
      4,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    const tileTexture = new THREE.DataTexture(
      new Uint8Array(4 * 4 * 4),
      4,
      4,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )

    const materials = createWaterPoolMaterials({
      waterTexture,
      causticTexture,
      tileTexture,
      boxes: [
        {
          center: uniform(new THREE.Vector3(-0.4, -0.68, 0.2)),
          halfSize: uniform(new THREE.Vector3(0.18, 0.18, 0.18)),
          color: uniform(new THREE.Vector3(0.8, 0.6, 0.2))
        }
      ],
      lightDirection: uniform(new THREE.Vector3(0.55, 0.9, 0.35).normalize())
    })

    const dispose = () => {
      materials.water.dispose()
      materials.pool.dispose()
      materials.boxes.forEach((material) => material.dispose())
      materials.sky.dispose()
      waterTexture.dispose()
      causticTexture.dispose()
      tileTexture.dispose()
    }

    return { materials, dispose }
  }

  it('builds node materials for the water, basin, boxes and sky', () => {
    const { materials, dispose } = createMaterials()

    expect(materials.water.name).toBe('WaterPoolSurface')
    expect(materials.water.positionNode).toBeDefined()
    expect(materials.water.colorNode).toBeDefined()
    expect(materials.water.side).toBe(THREE.DoubleSide)

    expect(materials.pool.name).toBe('WaterPoolBasin')
    expect(materials.pool.colorNode).toBeDefined()
    expect(materials.pool.side).toBe(THREE.DoubleSide)

    expect(materials.boxes).toHaveLength(1)
    expect(materials.boxes[0].name).toBe('WaterPoolBox')
    expect(materials.boxes[0].colorNode).toBeDefined()

    expect(materials.sky.name).toBe('WaterPoolSky')
    expect(materials.sky.side).toBe(THREE.BackSide)
    expect(materials.sky.depthWrite).toBe(false)

    dispose()
  })
})
