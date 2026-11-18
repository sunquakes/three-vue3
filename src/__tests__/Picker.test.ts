// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import Picker from '../utils/Picker'

const setup = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial())
  cube.name = 'cube'
  scene.add(cube)

  const canvas = document.createElement('canvas')
  const picker = new Picker(scene, camera, canvas, { targets: [cube] })

  return { scene, camera, cube, canvas, picker }
}

describe('Picker', () => {
  it('hits the object under the pointer', () => {
    const { cube, picker } = setup()

    // jsdom reports a zero-sized box, so the picker falls back to 1x1 and
    // (0.5, 0.5) maps to the centre of the canvas.
    const result = picker.pickAt(0.5, 0.5)

    expect(result).not.toBeNull()
    expect(result?.object).toBe(cube)
    expect(result?.distance).toBeCloseTo(4, 5)

    picker.dispose()
  })

  it('returns null when nothing is under the pointer', () => {
    const { picker } = setup()

    expect(picker.pickAt(0.5, 100)).toBeNull()

    picker.dispose()
  })

  it('applies the intersection filter', () => {
    const { picker } = setup()

    picker.setFilter((object) => object.name !== 'cube')

    expect(picker.pickAt(0.5, 0.5)).toBeNull()

    picker.dispose()
  })

  it('stops emitting after unsubscribe and dispose', () => {
    const { canvas, picker } = setup()
    const listener = vi.fn()

    const unsubscribe = picker.on('click', listener)
    unsubscribe()

    picker.dispose()

    expect(picker.getHovered()).toBeNull()
    expect(() => canvas.dispatchEvent(new Event('pointerdown'))).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })
})
