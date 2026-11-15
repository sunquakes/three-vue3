import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { GeoReference } from '../crs/GeoReference'
import { bindSceneGeo, getSceneGeo } from '../crs/SceneGeo'
import { FitCamera } from '../utils/FitCamera'

const ORIGIN = { lng: 116.391, lat: 39.907 }
const POINT = { lng: 116.397428, lat: 39.90923, alt: 80 }

describe('bindSceneGeo', () => {
  it('returns the same scene for chaining', () => {
    const scene = new THREE.Scene()
    expect(bindSceneGeo(scene, new GeoReference(ORIGIN))).toBe(scene)
  })

  it('exposes the bound reference through scene.getGeo and getSceneGeo', () => {
    const geo = new GeoReference(ORIGIN)
    const scene = bindSceneGeo(new THREE.Scene(), geo)
    expect(scene.getGeo?.()).toBe(geo)
    expect(getSceneGeo(scene)).toBe(geo)
  })

  it('returns undefined for a scene without a bound reference', () => {
    const scene = new THREE.Scene()
    expect(getSceneGeo(scene)).toBeUndefined()
    expect(scene.getGeo).toBeUndefined()
    expect(scene.setPosition).toBeUndefined()
  })

  it('installs helpers without a reference for local-coordinate fallback', () => {
    const scene = bindSceneGeo(new THREE.Scene())
    expect(getSceneGeo(scene)).toBeUndefined()
    expect(typeof scene.setPosition).toBe('function')
    expect(scene.getGeo?.()).toBeUndefined()
  })

  it('rebinds to a new reference when called again', () => {
    const first = new GeoReference(ORIGIN)
    const second = new GeoReference({ lng: 121.47, lat: 31.23 })
    const scene = bindSceneGeo(new THREE.Scene(), first)
    bindSceneGeo(scene, second)
    expect(getSceneGeo(scene)).toBe(second)
  })
})

describe('scene.setPosition with a bound reference', () => {
  it('projects a {lng, lat, alt} object exactly like geo.toLocal', () => {
    const geo = new GeoReference(ORIGIN)
    const scene = bindSceneGeo(new THREE.Scene(), geo)
    const object = new THREE.Object3D()

    scene.setPosition(object, POINT)

    const expected = geo.toLocal(POINT)
    expect(object.position.toArray().map((n) => Math.round(n * 1e6))).toEqual(
      expected.toArray().map((n) => Math.round(n * 1e6))
    )
  })

  it('projects a [lng, lat, alt] tuple exactly like geo.toLocal', () => {
    const geo = new GeoReference(ORIGIN)
    const scene = bindSceneGeo(new THREE.Scene(), geo)
    const object = new THREE.Object3D()

    scene.setPosition(object, [POINT.lng, POINT.lat, POINT.alt])

    const expected = geo.toLocal(POINT)
    expect(object.position.toArray().map((n) => Math.round(n * 1e6))).toEqual(
      expected.toArray().map((n) => Math.round(n * 1e6))
    )
  })

  it('defaults a two-element [lng, lat] tuple altitude to 0', () => {
    const geo = new GeoReference(ORIGIN)
    const scene = bindSceneGeo(new THREE.Scene(), geo)
    const object = new THREE.Object3D()

    scene.setPosition(object, [POINT.lng, POINT.lat])

    const expected = geo.toLocal({ lng: POINT.lng, lat: POINT.lat })
    expect(object.position.toArray().map((n) => Math.round(n * 1e6))).toEqual(
      expected.toArray().map((n) => Math.round(n * 1e6))
    )
  })

  it('positions a FitCamera and a mesh identically for the same tuple', () => {
    const scene = bindSceneGeo(new THREE.Scene(), new GeoReference(ORIGIN))
    const camera = new FitCamera()
    const mesh = new THREE.Object3D()

    scene.setPosition(camera, [POINT.lng, POINT.lat, 0])
    scene.setPosition(mesh, [POINT.lng, POINT.lat, 0])

    expect(camera.position.toArray()).toEqual(mesh.position.toArray())
  })

  it('maps the scene origin tuple to (0, 0, 0)', () => {
    const scene = bindSceneGeo(new THREE.Scene(), new GeoReference(ORIGIN))
    const object = new THREE.Object3D()
    scene.setPosition(object, [ORIGIN.lng, ORIGIN.lat])
    expect(object.position.toArray().map((n) => Math.round(n * 1e6))).toEqual([0, 0, 0])
  })

  it('honours an explicit datum for a tuple', () => {
    const geo = new GeoReference(ORIGIN, { datum: 'GCJ02' })
    const scene = bindSceneGeo(new THREE.Scene(), geo)
    const object = new THREE.Object3D()
    scene.setPosition(object, [POINT.lng, POINT.lat], 'GCJ02')

    const expected = geo.toLocal({ lng: POINT.lng, lat: POINT.lat }, 'GCJ02')
    expect(object.position.toArray().map((n) => Math.round(n * 1e6))).toEqual(
      expected.toArray().map((n) => Math.round(n * 1e6))
    )
  })

  it('uses a THREE.Vector3 as local metres without projecting', () => {
    const scene = bindSceneGeo(new THREE.Scene(), new GeoReference(ORIGIN))
    const object = new THREE.Object3D()
    scene.setPosition(object, new THREE.Vector3(10, -5, 20))
    expect(object.position.toArray()).toEqual([10, -5, 20])
  })

  it('uses a {x, y, z} object as local metres without projecting', () => {
    const scene = bindSceneGeo(new THREE.Scene(), new GeoReference(ORIGIN))
    const object = new THREE.Object3D()
    scene.setPosition(object, { x: 10, y: -5 })
    expect(object.position.toArray()).toEqual([10, -5, 0])
  })

  it('returns the object so calls can chain', () => {
    const scene = bindSceneGeo(new THREE.Scene(), new GeoReference(ORIGIN))
    const object = new THREE.Object3D()
    expect(scene.setPosition(object, [POINT.lng, POINT.lat])).toBe(object)
  })
})

describe('scene.setPosition fallback without a bound reference', () => {
  it('maps a tuple straight to local x/y/z metres', () => {
    const scene = bindSceneGeo(new THREE.Scene())
    const object = new THREE.Object3D()
    scene.setPosition(object, [10, -5, 20])
    expect(object.position.toArray()).toEqual([10, -5, 20])
  })

  it('maps a {lng, lat} object straight to local x/y and defaults z to 0', () => {
    const scene = bindSceneGeo(new THREE.Scene())
    const camera = new FitCamera()
    scene.setPosition(camera, { lng: 3, lat: 4 })
    expect(camera.position.toArray()).toEqual([3, 4, 0])
  })

  it('still treats THREE.Vector3 as local metres', () => {
    const scene = bindSceneGeo(new THREE.Scene())
    const object = new THREE.Object3D()
    scene.setPosition(object, new THREE.Vector3(1, 2, 3))
    expect(object.position.toArray()).toEqual([1, 2, 3])
  })
})
