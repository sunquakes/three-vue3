import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import RainEffect from '../effects/RainEffect'
import SnowEffect from '../effects/SnowEffect'

describe('weather effects', () => {
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
    expect(material.isPointsNodeMaterial).toBe(true)
    expect(material.transparent).toBe(true)
    expect(snow.mesh.geometry.getAttribute('aSeed')).toBeDefined()

    expect(() => snow.update(0.25)).not.toThrow()

    snow.dispose()
    expect(scene.children).not.toContain(snow.mesh)
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
