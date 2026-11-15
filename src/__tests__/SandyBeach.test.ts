import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  BEACH_CIRCUMFERENCE,
  BEACH_EYE_CROUCHING,
  BEACH_EYE_STANDING,
  BEACH_PITCH_MAX,
  BEACH_PITCH_MIN,
  BEACH_RADIUS,
  BEACH_U_MAX,
  BEACH_U_MIN,
  BeachWalker,
  beachHeight,
  beachPosition,
  toShoreCoordinates
} from '../utils/BeachTerrain'
import { BEACH_FOOTPRINT_CAPACITY, BeachFootprintTrail } from '../utils/BeachFootprints'
import {
  BEACH_PRESET_NAMES,
  BEACH_PRESETS,
  createBeachPresetState,
  lerpBeachPresetState
} from '../utils/BeachPresets'

describe('beachHeight', () => {
  it('rises from the waterline towards the inland slope', () => {
    let previous = beachHeight(0)
    for (let u = 1; u <= 10; u += 1) {
      const height = beachHeight(u)
      expect(height).toBeGreaterThanOrEqual(previous)
      previous = height
    }
  })

  it('descends below the waterline for negative u', () => {
    expect(beachHeight(-4)).toBeLessThan(beachHeight(0))
    expect(beachHeight(-4)).toBeCloseTo(-0.88)
  })

  it('keeps the walkable slope rising and below a few metres', () => {
    let previous = beachHeight(9)
    for (let u = 10; u <= BEACH_U_MAX; u += 1) {
      const height = beachHeight(u)
      expect(height).toBeGreaterThan(previous)
      previous = height
    }
    expect(previous).toBeLessThan(6)
  })
})

describe('shore coordinates', () => {
  it('round-trips between polar position and shore coordinates', () => {
    for (const theta of [-Math.PI, -1.2, 0, 0.8, 2.5]) {
      for (const u of [BEACH_U_MIN, 3, 9, BEACH_U_MAX]) {
        const position = beachPosition(theta, u)
        const coordinates = toShoreCoordinates(position.x, position.z)

        expect(coordinates.u).toBeCloseTo(u, 5)
        expect(coordinates.theta).toBeCloseTo(theta, 5)
        const expectedS = ((theta + Math.PI) / (2 * Math.PI)) * BEACH_CIRCUMFERENCE
        expect(coordinates.s).toBeCloseTo(expectedS, 5)
      }
    }
  })

  it('keeps s within one circumference', () => {
    const coordinates = toShoreCoordinates(BEACH_RADIUS, 0)
    expect(coordinates.s).toBeGreaterThanOrEqual(0)
    expect(coordinates.s).toBeLessThan(BEACH_CIRCUMFERENCE)
  })
})

describe('BeachWalker', () => {
  it('starts at the configured height standing up', () => {
    const walker = new BeachWalker({ theta: 0, u: 6 })
    const frame = walker.update(0)

    expect(frame.eyeHeight).toBeCloseTo(BEACH_EYE_STANDING)
    expect(frame.u).toBeCloseTo(6)
    expect(frame.footprints).toHaveLength(0)
  })

  it('walks towards the water and clamps at the minimum u', () => {
    const walker = new BeachWalker({ theta: 0, u: 7, yaw: Math.PI })

    for (let frame = 0; frame < 200; frame += 1) {
      walker.update(0.1, { autoWalk: true })
    }

    expect(walker.u).toBeCloseTo(BEACH_U_MIN)
  })

  it('walks inland and clamps at the maximum u', () => {
    const walker = new BeachWalker({ theta: 0, u: 7, yaw: Math.PI / 2 })

    for (let frame = 0; frame < 200; frame += 1) {
      walker.update(0.1, { autoWalk: true })
    }

    expect(walker.u).toBeCloseTo(BEACH_U_MAX)
  })

  it('emits alternating footprints once enough ground is covered', () => {
    const walker = new BeachWalker({ theta: 0, u: 7, yaw: Math.PI })
    const footprints = []

    for (let frame = 0; frame < 30; frame += 1) {
      footprints.push(...walker.update(0.1, { autoWalk: true }).footprints)
    }

    expect(footprints.length).toBeGreaterThan(2)
    const sides = footprints.map((sample) => sample.side)
    expect(sides[0]).toBe(1)
    expect(sides[1]).toBe(-1)
    sides.forEach((side) => expect(Math.abs(side)).toBe(1))
    footprints.forEach((sample) => {
      expect(Number.isFinite(sample.s)).toBe(true)
      expect(Number.isFinite(sample.u)).toBe(true)
      expect(Number.isFinite(sample.heading)).toBe(true)
    })
  })

  it('smooths the crouch instead of snapping', () => {
    const walker = new BeachWalker()

    const first = walker.update(0.033, { crouching: true })
    expect(first.eyeHeight).toBeLessThan(BEACH_EYE_STANDING)
    expect(first.eyeHeight).toBeGreaterThan(BEACH_EYE_CROUCHING)

    for (let frame = 0; frame < 200; frame += 1) {
      walker.update(0.1, { crouching: true })
    }

    expect(walker.eyeHeight).toBeCloseTo(BEACH_EYE_CROUCHING, 2)
  })

  it('clamps the look pitch to the walker range', () => {
    const walker = new BeachWalker()

    walker.setLookDelta(0, -10000)
    expect(walker.pitch).toBeCloseTo(BEACH_PITCH_MAX)

    walker.setLookDelta(0, 10000)
    expect(walker.pitch).toBeCloseTo(BEACH_PITCH_MIN)
  })
})

describe('beach presets', () => {
  it('points every sun direction along a unit vector matching its elevation', () => {
    BEACH_PRESET_NAMES.forEach((name) => {
      const state = createBeachPresetState(name)
      const preset = BEACH_PRESETS[name]

      expect(state.sunDirection.length()).toBeCloseTo(1, 5)
      expect(state.sunDirection.y).toBeCloseTo(
        Math.sin(THREE.MathUtils.degToRad(preset.elevation)),
        5
      )
    })
  })

  it('blends two preset states in place', () => {
    const sunrise = createBeachPresetState('sunrise')
    const night = createBeachPresetState('night')
    const current = createBeachPresetState('sunrise')
    const target = createBeachPresetState('night')
    const expectedZenith = sunrise.zenith.clone().lerp(night.zenith, 0.5)

    lerpBeachPresetState(current, target, 0.5)

    expect(current.sunDisk).toBeCloseTo((sunrise.sunDisk + night.sunDisk) / 2)
    expect(current.night).toBeCloseTo((sunrise.night + night.night) / 2)
    expect(current.zenith.r).toBeCloseTo(expectedZenith.r)
    expect(current.zenith.g).toBeCloseTo(expectedZenith.g)
    expect(current.zenith.b).toBeCloseTo(expectedZenith.b)
    expect(current.sunDirection.length()).toBeCloseTo(1, 5)
  })
})

describe('BeachFootprintTrail', () => {
  it('uploads a 24x1 float texture', () => {
    const trail = new BeachFootprintTrail()
    const image = trail.texture.image as { width: number; height: number }

    expect(trail.capacity).toBe(BEACH_FOOTPRINT_CAPACITY)
    expect(image.width).toBe(BEACH_FOOTPRINT_CAPACITY)
    expect(image.height).toBe(1)
    expect(trail.texture.type).toBe(THREE.FloatType)

    trail.dispose()
  })

  it('stores s, u, heading and birth time in each texel', () => {
    const trail = new BeachFootprintTrail()

    trail.add({ s: 12, u: 3.5, heading: 0.25, side: 1 }, 8)
    const data = trail.snapshot()

    expect(data[0]).toBeCloseTo(12)
    expect(data[1]).toBeCloseTo(3.5)
    expect(data[2]).toBeCloseTo(0.25)
    expect(data[3]).toBeCloseTo(8)
    expect(trail.written).toBe(1)

    trail.dispose()
  })

  it('wraps around once the capacity is exceeded', () => {
    const trail = new BeachFootprintTrail()

    for (let index = 0; index < BEACH_FOOTPRINT_CAPACITY + 3; index += 1) {
      trail.add({ s: index, u: 1, heading: 0, side: 1 }, index)
    }

    const data = trail.snapshot()
    expect(data[0]).toBe(BEACH_FOOTPRINT_CAPACITY)
    expect(data[1 * 4]).toBe(BEACH_FOOTPRINT_CAPACITY + 1)
    expect(trail.written).toBe(BEACH_FOOTPRINT_CAPACITY)

    trail.dispose()
  })
})
