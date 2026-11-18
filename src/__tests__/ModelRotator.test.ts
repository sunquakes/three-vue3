import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import ModelRotator from '../utils/ModelRotator'

let frames: FrameRequestCallback[]

const step = (time: number) => {
  const pending = frames
  frames = []
  pending.forEach((callback) => callback(time))
}

beforeEach(() => {
  frames = []
  vi.spyOn(performance, 'now').mockReturnValue(0)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ModelRotator', () => {
  it('advances the rotation for the elapsed time', () => {
    const model = new THREE.Object3D()
    const rotator = new ModelRotator(model, { axis: 'y', speed: 1 })

    step(500)
    expect(model.rotation.y).toBeCloseTo(0.5, 5)

    step(1000)
    expect(model.rotation.y).toBeCloseTo(1, 5)

    rotator.dispose()
  })

  it('pauses and resumes without losing the angle', () => {
    const model = new THREE.Object3D()
    const rotator = new ModelRotator(model, { speed: 1 })

    step(500)
    rotator.pause()
    step(1000)
    expect(model.rotation.y).toBeCloseTo(0.5, 5)

    rotator.play()
    step(1500)
    expect(model.rotation.y).toBeGreaterThan(0.5)

    rotator.dispose()
  })

  it('honours the axis and speed setters', () => {
    const model = new THREE.Object3D()
    const rotator = new ModelRotator(model, { speed: 1 })

    rotator.setAxis('x')
    rotator.setSpeed(2)
    step(1000)

    expect(model.rotation.x).toBeCloseTo(2, 5)
    expect(model.rotation.y).toBe(0)

    rotator.dispose()
  })

  it('stop resets the rotation and dispose is idempotent', () => {
    const model = new THREE.Object3D()
    const rotator = new ModelRotator(model)

    model.rotation.set(1, 1, 1)
    rotator.stop()

    expect(model.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0])
    expect(() => rotator.dispose()).not.toThrow()
  })
})
