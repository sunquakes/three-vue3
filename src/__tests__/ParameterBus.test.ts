import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { ParameterBus } from '../utils/ParameterBus'

describe('ParameterBus', () => {
  it('starts with a normalized sun direction', () => {
    const bus = new ParameterBus()
    const direction = bus.get('sunDirection')

    expect(direction.length()).toBeCloseTo(1, 5)
    expect(direction.y).toBeGreaterThan(0)
  })

  it('clones and normalizes vectors on set', () => {
    const bus = new ParameterBus()
    const input = new THREE.Vector3(0, 0, 4)

    bus.set('sunDirection', input)
    input.set(1, 1, 1)

    const stored = bus.get('sunDirection')
    expect(stored).not.toBe(input)
    expect(stored.z).toBeCloseTo(1, 5)
  })

  it('notifies subscribers until they unsubscribe', () => {
    const bus = new ParameterBus()
    const listener = vi.fn()

    const unsubscribe = bus.subscribe('sunDirection', listener)
    bus.set('sunDirection', new THREE.Vector3(1, 0, 0))

    expect(listener).toHaveBeenCalledTimes(1)
    const [, previous] = listener.mock.calls[0]
    expect(previous.length()).toBeCloseTo(1, 5)

    unsubscribe()
    bus.set('sunDirection', new THREE.Vector3(0, 1, 0))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('restores defaults and notifies on reset', () => {
    const bus = new ParameterBus()
    const listener = vi.fn()

    bus.subscribe('sunDirection', listener)
    bus.set('sunDirection', new THREE.Vector3(1, 0, 0))
    bus.reset()

    expect(listener).toHaveBeenCalledTimes(2)
    expect(bus.get('sunDirection').y).toBeCloseTo(0.2, 1)
  })
})
