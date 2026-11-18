import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import RainEffect from '../effects/RainEffect'
import SnowEffect from '../effects/SnowEffect'
import { SnowCover } from '../utils/SnowCover'

describe('weather effects', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('advances rain time and removes itself on dispose', () => {
    const scene = new THREE.Scene()
    const rain = new RainEffect({ count: 10 })

    scene.add(rain.mesh)
    expect(scene.children).toContain(rain.mesh)

    const material = rain.mesh.material
    expect(material.isPointsNodeMaterial).toBe(true)
    expect(material.transparent).toBe(true)
    expect(rain.mesh.geometry.getAttribute('aSeed')).toBeDefined()

    expect(() => rain.update(0.5)).not.toThrow()

    rain.dispose()
    expect(scene.children).not.toContain(rain.mesh)
  })

  it('advances snow time and removes itself on dispose', () => {
    const scene = new THREE.Scene()
    const snow = new SnowEffect({ count: 10, size: 4 })

    scene.add(snow.mesh)

    const material = snow.mesh.material
    expect(material.isNodeMaterial).toBe(true)
    expect(material.transparent).toBe(true)
    expect(snow.mesh.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry)
    expect(snow.mesh.geometry.instanceCount).toBe(10)
    expect(snow.mesh.geometry.getAttribute('aOffset')).toBeDefined()
    expect(snow.mesh.geometry.getAttribute('aScale')).toBeDefined()
    expect(snow.mesh.geometry.getAttribute('aRotation')).toBeDefined()

    expect(() => snow.update(0.25)).not.toThrow()

    snow.dispose()
    expect(scene.children).not.toContain(snow.mesh)
  })

  it('accumulates on default scene targets and removes the cover on dispose', () => {
    const scene = new THREE.Scene()
    const target = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    scene.add(target)

    const snow = new SnowEffect({ count: 4, accumulate: true })
    scene.add(snow.mesh)
    const coverUpdate = vi.spyOn(SnowCover.prototype, 'update')

    snow.mesh.onBeforeRender(
      { isWebGPURenderer: false } as unknown as THREE.WebGLRenderer,
      scene,
      new THREE.Camera(),
      snow.mesh.geometry,
      snow.mesh.material,
      new THREE.Group()
    )

    const shell = target.children.find((child) => child.userData.isSnowCover === true)
    expect(shell).toBeInstanceOf(THREE.Mesh)

    snow.update(0.5)
    expect(coverUpdate).toHaveBeenCalledWith(0.5)

    snow.dispose()
    expect(target.children).not.toContain(shell)
    target.geometry.dispose()
    target.material.dispose()
  })

  it('never intercepts picking', () => {
    const rain = new RainEffect({ count: 4 })
    const snow = new SnowEffect({ count: 4 })
    const raycaster = new THREE.Raycaster()

    expect(raycaster.intersectObject(rain.mesh)).toHaveLength(0)
    expect(raycaster.intersectObject(snow.mesh)).toHaveLength(0)

    rain.dispose()
    snow.dispose()
  })
})
