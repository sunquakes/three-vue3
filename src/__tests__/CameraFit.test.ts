import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { fitCameraToBox, fitCameraToObject, fitCameraToPoints } from '../utils/CameraFit'

describe('camera fitting', () => {
  it('places the camera outside the object and looks at its centre', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 12))
    sphere.position.set(3, 1, -2)

    const result = fitCameraToObject(camera, sphere)

    expect(result).toBe(camera)
    expect(camera.position.distanceTo(sphere.position)).toBeGreaterThan(2)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const toCentre = sphere.position.clone().sub(camera.position).normalize()
    expect(forward.dot(toCentre)).toBeCloseTo(1, 4)
    expect(camera.near).toBeGreaterThan(0)
    expect(camera.far).toBeGreaterThan(camera.position.distanceTo(sphere.position))
  })

  it('syncs the controls target and calls update', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
    const controls = { target: new THREE.Vector3(), update: vi.fn() }

    fitCameraToBox(camera, box, { controls: controls as never })

    expect(controls.target.toArray()).toEqual([0, 0, 0])
    expect(controls.update).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty box', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const before = camera.position.clone()

    fitCameraToBox(camera, new THREE.Box3())

    expect(camera.position.equals(before)).toBe(true)
  })

  it('frames a set of plain points', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)

    fitCameraToPoints(camera, [
      { x: -2, y: 0 },
      { x: 2, y: 2, z: 1 }
    ])

    expect(camera.position.length()).toBeGreaterThan(0)
    expect(Number.isFinite(camera.position.x)).toBe(true)
  })

  it('honours a distance override', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))

    fitCameraToBox(camera, box, { distance: 12, elevation: 0, azimuth: 0 })

    expect(camera.position.distanceTo(new THREE.Vector3())).toBeCloseTo(12, 5)
  })
})
