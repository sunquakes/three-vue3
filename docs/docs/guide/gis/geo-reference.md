---
lang: en-US
title: Geographic Reference
---

::: tip type
Class + Scene props
:::

## Concept

`GeoReference` binds a coordinate reference system, a geodetic datum and an
axis convention to a fixed **local origin**. The conversion pipeline is:

```text
geographic (lng, lat, alt)
  -> datum normalize to WGS84
  -> local tangent plane (float64 metres)
  -> recenter around the local origin
  -> ENU -> three.js axis mapping (East:+X, North:-Z, Up:+Y)
  -> THREE.Vector3 (float32)
```

The local origin is what keeps scene coordinates small. Absolute Web Mercator
coordinates are around 1.3e7 metres, which would jitter badly in three.js
float32 positions at city scale; after recentering, every object sits within a
few kilometres of `(0, 0, 0)`.

A `GeoReference` always exists on a Scene. When no GIS props are supplied it
uses the WGS84/equirectangular defaults centred at `(0, 0)`, which is a no-op
for ordinary non-geographic scenes, so this feature is fully opt-in.

## Default Usage

<GeoObjectDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :origin="ORIGIN"
    :grid-helper="GRID"
    @created="created"
  >
    <GeoObject
      v-for="(marker, index) in MARKERS"
      :key="index"
      :coordinate="marker"
      datum="GCJ02"
      :object="anchors[index]"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import { GeoObject } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

const ORIGIN: GeoPoint = { lng: 116.391, lat: 39.907 }
const GRID = { size: 1400, divisions: 28, colorCenterLine: 0x4a6fa5, colorGrid: 0x2f3e5c }
const MARKERS: GeoPoint[] = [
  { lng: 116.397428, lat: 39.90923 },
  { lng: 116.4005, lat: 39.9117 },
  { lng: 116.3945, lat: 39.912 }
]

const anchors = shallowRef<THREE.Object3D[]>([])

const created = (scene, { camera }) => {
  // The scene converts a local-metre viewpoint and projects geographic points.
  scene.setPosition(camera, { x: 0, y: 750, z: 1000 })
  camera.lookAt(0, 0, 0)

  // Every marker is created here, in the created handler; GeoObject projects
  // its coordinate through the scene's own reference.
  anchors.value = MARKERS.map(() => {
    const anchor = new THREE.Group()
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(40, 120, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    )
    cone.position.y = 60
    anchor.add(cone)
    return anchor
  })
}

onBeforeUnmount(() => {
  anchors.value.forEach((anchor) => {
    anchor.removeFromParent()
    anchor.traverse((child) => {
      const mesh = child as THREE.Mesh
      mesh.geometry?.dispose()
      ;(mesh.material as THREE.Material | undefined)?.dispose()
    })
  })
  anchors.value = []
})
</script>
```

:::

## Scene Props

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| origin | GeoPoint | `{ lng: 0, lat: 0, alt: 0 }` | Local tangent-plane origin; all scene coordinates are relative to it |
| crs | `'EPSG:4326' \| 'EPSG:3857'` | `'EPSG:4326'` | Planar model: equirectangular tangent plane or recentered Web Mercator |
| datum | `'WGS84' \| 'GCJ02' \| 'BD09'` | `'WGS84'` | Datum of the coordinates passed to the scene |
| axes | AxesMapping | `{ east: 'x', north: '-z', up: 'y' }` | Maps the ENU basis onto signed three.js axes |
| geo | GeoReference | — | Supply a pre-built reference instead of `origin`/`crs`/`datum`/`axes` |

The reference built by the Scene is available as `components.geo` inside the
`created` handler and via `useScene().geo`. It is also bound to the scene
itself, so most code never has to name `geo` at all.

## Positioning Objects

Every Scene binds its `GeoReference` to the scene instance and installs one
positioning helper, `scene.setPosition(object, position, datum?)`. Because the
scene already knows its own reference, a geographic position needs only the
coordinates themselves — no reference threading — and the exact same call places
a mesh, a group or a camera, since all of them are `THREE.Object3D`.

The position accepts every convenient shape (`ScenePosition`):

| Position shape | Interpretation |
| --- | --- |
| `{ lng, lat, alt? }` | Geographic point, projected through the scene's reference |
| `[lng, lat]` | Geographic point, altitude defaults to `0` |
| `[lng, lat, alt]` | Geographic point as a plain tuple |
| `THREE.Vector3` | Local metres, used as-is (no projection) |
| `{ x, y, z? }` | Local metres as a plain object, `z` defaults to `0` |

```ts
const created = (scene) => {
  // All four are geographic and projected through the scene's own reference.
  scene.setPosition(mesh, { lng: 116.397, lat: 39.909 })
  scene.setPosition(mesh, { lng: 116.397, lat: 39.909, alt: 35 })
  scene.setPosition(mesh, [116.397, 39.909])
  scene.setPosition(mesh, [116.397, 39.909, 35])

  // A per-call datum overrides the scene datum for GCJ02/BD09 input.
  scene.setPosition(mesh, [116.403, 39.915], 'GCJ02')

  // A camera is positioned with the identical call.
  scene.setPosition(camera, [116.397428, 39.90923, 120])

  // Local metres are used directly, no projection.
  scene.setPosition(helper, new THREE.Vector3(10, 0, -5))
  scene.setPosition(helper, { x: 10, y: 0, z: -5 })
}
```

The method returns the object passed in, so calls can chain. A scene you create
yourself without `<tv-scene>` has no helper; either call `bindSceneGeo(scene, geo)`
once or read the reference with `getSceneGeo(scene)`. On a scene with helpers but
no bound reference, geographic tuples/objects fall back to local coordinates and
map `lng/lat/alt` straight onto `x/y/z`, so the call is always safe.

| Helper | Signature | Description |
| --- | --- | --- |
| scene.setPosition | (object: Object3D, position: ScenePosition, datum?: DatumType) => Object3D | Place any object; geographic inputs are projected, local metres used as-is |
| scene.getGeo | () => GeoReference \| undefined | Read the reference bound to the scene |
| bindSceneGeo | (scene: Scene, geo?: GeoReference) => Scene | Install the helpers on a scene and optionally bind a reference |
| getSceneGeo | (scene: Scene) => GeoReference \| undefined | Functional equivalent of `scene.getGeo()` |
| ensureSceneGeo | (scene: Scene) => Scene | Install the helpers on a scene that lacks them |

## GeoReference Methods

| Name | Parameters | Description |
| ---- | ---------- | ----------- |
| constructor | (origin?: GeoPoint, options?: GeoReferenceOptions) => GeoReference | Builds the reference and its tangent plane |
| toLocal | (p: GeoPoint, datum?: DatumType, target?: Vector3) => Vector3 | Geographic point -> local metres |
| toGeo | (v: Vector3, datum?: DatumType, target?: GeoPoint) => GeoPoint | Local metres -> geographic point |
| setPosition | (object: Object3D, p: GeoPoint, datum?: DatumType) => Object3D | Places an existing object at a geographic position |
| distance | (a: GeoPoint, b: GeoPoint, datum?: DatumType) => number | Planar distance in metres |

```ts
import { GeoReference } from 'three-vue3'
import type { GeoPoint } from 'three-vue3'

const origin: GeoPoint = { lng: 116.397, lat: 39.909 }
const geo = new GeoReference(origin, { crs: 'EPSG:4326', datum: 'WGS84' })

// Local metres relative to the origin (float64 internally).
const local = geo.toLocal({ lng: 116.4005, lat: 39.909 })

// Convert back; pass a per-call datum when mixing data sources.
const back = geo.toGeo(local)

// GCJ02 (AMap/Tencent) input is normalized automatically.
const fromMars = geo.toLocal({ lng: 116.403, lat: 39.915 }, 'GCJ02')
```

## Datum Helpers

Chinese map services use encrypted datums; mixing them with raw GPS (WGS84)
data without conversion causes offsets of 50–600 metres inside China.

| Function | Signature | Description |
| -------- | --------- | ----------- |
| toWGS84 | (p: GeoPoint, from: DatumType) => GeoPoint | Convert GCJ02/BD09 to WGS84 |
| fromWGS84 | (p: GeoPoint, to: DatumType) => GeoPoint | Convert WGS84 to GCJ02/BD09 |
| convertDatum | (p: GeoPoint, from: DatumType, to: DatumType) => GeoPoint | Convert between any datums |
| wgs84ToGcj02 / gcj02ToWgs84 | (p: GeoPoint) => GeoPoint | Direct WGS84 `<->` GCJ02 |
| gcj02ToBd09 / bd09ToGcj02 | (p: GeoPoint) => GeoPoint | Direct GCJ02 `<->` BD09 |

The GCJ02 -> WGS84 inverse uses fixed-point iteration; the BD09 closed-form
inverse has an inherent residual of a few centimetres.

## Projection Helpers

| Function | Description |
| -------- | ----------- |
| mercatorProject(p) | EPSG:4326 degrees -> EPSG:3857 Web Mercator metres |
| mercatorUnproject(v) | EPSG:3857 metres -> EPSG:4326 degrees |
| createLocalPlane(code, origin) | Builds a recentered `LocalPlane` for either CRS |
