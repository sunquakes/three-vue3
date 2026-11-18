import * as THREE from 'three'
import { GeoReference } from './GeoReference'
import type { DatumType, GeoPoint } from './types'

/**
 * A position already expressed in the local three.js metre frame. Both
 * `THREE.Vector3` and a plain `{x, y, z}` object are accepted.
 */
export type SceneLocalPoint = THREE.Vector3 | { x: number; y: number; z?: number }

/**
 * Every position shape accepted by `scene.setPosition`. Because the scene
 * already carries its {@link GeoReference}, a geographic position can be given
 * as a plain `[lng, lat]` / `[lng, lat, alt]` tuple or a `{lng, lat, alt}`
 * object; it is projected through the scene's reference. A `THREE.Vector3` /
 * `{x, y, z}` is treated as local metres and used as-is.
 */
export type ScenePosition = GeoPoint | [number, number] | [number, number, number] | SceneLocalPoint

/**
 * Scene-level geographic positioning.
 *
 * A scene created by three-vue3's `<tv-scene>` carries its {@link GeoReference}
 * in `scene.userData.geo` (attached once while the scene is created), so
 * callers never need to thread the reference around by hand. The same
 * `setPosition` call positions a camera and a mesh because both are
 * `THREE.Object3D`.
 *
 * When the scene has no bound reference (helpers installed without a geo, or a
 * scene whose geo was cleared), geographic tuples/objects fall back to local
 * coordinates: `lng/lat/alt` map straight to `x/y/z` in metres, so the call is
 * always safe.
 */
declare module 'three' {
  interface Scene {
    /** The geographic reference bound to this scene, if any. */
    getGeo?: () => GeoReference | undefined
    /**
     * Place any object (camera, mesh, group) at a position. A `[lng, lat]`
     * tuple or `{lng, lat}` point is projected through the scene's reference;
     * a `THREE.Vector3` / `{x, y, z}` is used as local metres. Without a bound
     * reference, geographic inputs map straight onto `x/y/z`.
     */
    setPosition: <T extends THREE.Object3D>(
      object: T,
      position: ScenePosition,
      datum?: DatumType
    ) => T
  }
}

function readSceneGeo(scene: THREE.Scene): GeoReference | undefined {
  const geo = scene.userData?.geo as unknown
  return geo instanceof GeoReference ? geo : undefined
}

function isGeoPosition(
  position: ScenePosition
): position is GeoPoint | [number, number] | [number, number, number] {
  if (Array.isArray(position)) return true
  return (
    position !== null &&
    typeof position === 'object' &&
    typeof (position as GeoPoint).lng === 'number' &&
    typeof (position as GeoPoint).lat === 'number'
  )
}

function toGeoPoint(position: GeoPoint | [number, number] | [number, number, number]): GeoPoint {
  if (Array.isArray(position)) {
    return { lng: position[0], lat: position[1], alt: position[2] }
  }
  return position
}

function applyLocal(object: THREE.Object3D, position: SceneLocalPoint): void {
  // Duck-type via isVector3 so vectors from the separate `three/webgpu` bundle
  // (whose Vector3 has a different class identity) are still copied directly.
  if ((position as THREE.Vector3).isVector3 === true) {
    object.position.copy(position as THREE.Vector3)
  } else {
    const local = position as { x: number; y: number; z?: number }
    object.position.set(local.x, local.y, local.z ?? 0)
  }
}

/**
 * Install the `getGeo`/`setPosition` helpers on a scene instance and, when a
 * {@link GeoReference} is supplied, bind it to `scene.userData.geo`. Called
 * once by three-vue3 while the scene is created; safe to call again to rebind
 * or to clear the reference (pass `undefined`). Methods live on the instance
 * rather than the prototype because `three` and `three/webgpu` are separate
 * bundles with distinct Scene classes.
 */
export function bindSceneGeo(scene: THREE.Scene, geo?: GeoReference): THREE.Scene {
  if (geo) {
    scene.userData.geo = geo
  }
  scene.getGeo = () => readSceneGeo(scene)
  scene.setPosition = <T extends THREE.Object3D>(
    object: T,
    position: ScenePosition,
    datum?: DatumType
  ): T => {
    if (isGeoPosition(position)) {
      const point = toGeoPoint(position)
      const reference = readSceneGeo(scene)
      if (reference) {
        reference.setPosition(object, point, datum)
      } else {
        object.position.set(point.lng, point.lat, point.alt ?? 0)
      }
    } else {
      applyLocal(object, position)
    }
    return object
  }
  return scene
}

/** Read the {@link GeoReference} bound to a scene, or `undefined` when none. */
export function getSceneGeo(scene: THREE.Scene): GeoReference | undefined {
  return readSceneGeo(scene)
}

/**
 * Ensure the scene carries the `setPosition` helper. Scenes built by
 * three-vue3's `<tv-scene>` already have it; a user-supplied bare scene (e.g.
 * handed to `GeoObject` via its `scene` prop) is bound here without a
 * reference, so positioning falls back to treating coordinates as local metres.
 * Safe to call repeatedly — a scene that already has the helper is returned
 * untouched.
 */
export function ensureSceneGeo(scene: THREE.Scene): THREE.Scene {
  if (typeof scene.setPosition !== 'function') {
    bindSceneGeo(scene)
  }
  return scene
}
