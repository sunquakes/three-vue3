---
name: three-vue3
description: Build and debug Vue 3 three.js scenes with the three-vue3 component library. Use when a task involves tv-scene, tv-gltf-loader, tv-rain, tv-snow, Picker, FitCamera, ModelRotator, SkyDome, or disposing three.js resources in a Vue app.
---

# three-vue3

Three Vue3 wraps `three` in renderless Vue 3 components plus a small set of runtime classes. Use this skill whenever you add, review, or debug 3D code in a project that depends on `three-vue3`.

## Golden path

```vue
<template>
  <tv-scene class="scene" bg-color="#060409" @created="created">
    <tv-gltf-loader v-model="url" cache @loaded="onLoaded" />
    <tv-rain v-if="weather === 'rain'" :count="1500" />
  </tv-scene>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const url = ref('/models/perseverance.glb')
const weather = ref('clear')

const created = (scene, { camera, renderer, light }) => {
  camera.position.set(0, 2, 6)
}

const onLoaded = (gltf) => {
  // gltf is the loaded THREE.Group / Object3D added to the scene.
}
</script>

<style>
.scene {
  width: 100%;
  height: 300px;
}
</style>
```

Rules for `<tv-scene>`:

- It owns the renderer, camera, light, axes helper, and `OrbitControls`. Do not create a second renderer or an extra animation loop.
- `renderer-type` picks the backend: `webgpu` (default) or `webgl`. Both run the same TSL node materials, so write effects once.
- `@created(scene, { camera, light, renderer, axesHelper, gridHelper, controls, geo })` runs once after the scene exists. Put imperative setup here.
- Use `v-model:camera` to supply a custom camera (for example `FitCamera`) and `v-model:controls="false"` to disable orbiting.
- The container must have a non-zero size. Give it CSS width/height; never read `clientWidth` at module scope.
- Children of `<tv-scene>` are renderless; they attach themselves to the injected scene.

## Components vs classes

| Task            | Component                    | Class              |
| --------------- | ---------------------------- | ------------------ |
| Load GLB/GLTF   | `<tv-gltf-loader>`           | `GLTFLoader()`     |
| Load OBJ + MTL  | `<tv-obj-loader>`            | `OBJLoader()`      |
| Rain            | `<tv-rain>`                  | `RainEffect`       |
| Snow            | `<tv-snow>`                  | `SnowEffect`       |
| Bloom           | `<tv-bloom>`                 | no class           |
| Height fog      | `<tv-height-fog>`            | no class           |
| Ocean surface   | `<tv-water>`                 | no class           |
| Water pool      | `<tv-water-pool>`            | no class           |
| Sandy beach     | `<tv-sandy-beach>`           | `mountBeachScene()` |
| Geo object      | `<tv-geo-object>`            | `GeoReference`     |
| GeoJSON / tiles | `<tv-geo-json-layer>`, `<tv-tile-layer>` | `GeoReference` |
| Sky             | no component                 | `SkyDome`          |
| Camera framing  | no component                 | `FitCamera`        |
| Hover/click     | no component                 | `Picker`           |
| Turntable spin  | no component                 | `ModelRotator`     |

Use components inside a `<tv-scene>`. Use classes when you need explicit lifecycle control, when the scene is created outside Vue, or when the effect lives in a plain three.js module.

## Composition API access

```ts
import { onBeforeUnmount } from 'vue'
import { useFrame, useScene } from 'three-vue3'

const { scene, camera, renderer } = useScene()
const stop = useFrame((renderer, scene, components, delta) => {
  // Called before the scene render by default.
}, 'before')

onBeforeUnmount(stop)
```

- `useScene()` must be called inside a `<tv-scene>` subtree; it throws otherwise.
- `useFrame(callback, phase)` returns an unsubscribe function and auto-unsubscribes on unmount.
- `delta` is clamped to `0.1` seconds. Use it for all time-based motion.

## Framing, picking, rotation

```ts
import { FitCamera, ModelRotator, Picker } from 'three-vue3'

const camera = new FitCamera(45, 1, 0.1, 2000)
camera.bind(controls).fitToObject(model, { padding: 1.4 })

const rotator = new ModelRotator(model, { axis: 'y', speed: 0.4, autoStart: true })

const picker = new Picker(scene, camera, renderer.domElement, { targets: [model] })
picker.on('hover', (event) => {
  renderer.domElement.style.cursor = event ? 'pointer' : ''
})
picker.on('click', (event) => {
  if (event) console.log(event.object.name)
})
```

- `fitToPoints`, `fitToObject`, and `fitToBox` return the camera, so calls can be chained.
- `Picker` fires `hover` with `null` when the pointer leaves all targets. It ignores drags beyond 5 px.
- `ModelRotator` runs its own `requestAnimationFrame`; call `dispose()` to stop it.

## Shared sun direction

`globalParameterBus` stores scene-wide values. `SkyDome` subscribes to `sunDirection` when no explicit direction is passed.

```ts
import { SkyDome, globalParameterBus } from 'three-vue3'

const dome = new SkyDome({ radius: 400 })
scene.add(dome)

// One update reaches the dome and every other subscriber.
globalParameterBus.set('sunDirection', new THREE.Vector3(1, 0.4, 0.6).normalize())
```

Call `globalParameterBus.reset()` in tests and `dome.dispose()` on teardown.

## Geographic scenes

`<tv-scene>` accepts `origin`, `crs`, `datum` and `axes` to build a `GeoReference`; children then place objects by lng/lat instead of scene metres.

```vue
<tv-scene :origin="[121.47, 31.23]" datum="GCJ02">
  <tv-geo-object :coordinate="[121.47, 31.23]" :on-ready="onReady" />
  <tv-tile-layer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" :zoom="16" />
</tv-scene>
```

- `@created` and `useScene()` also expose `geo`; use `geo.toLocal(lngLat)` / `geo.toGeo(vector)` instead of calling projections yourself.
- `TileLayer` streams tiles around the camera and takes a `url` template; `GeoJsonLayer` accepts GeoJSON with a `style` callback.
- Both components call `onReady(object)` and accept an explicit `scene` prop when used outside a `<tv-scene>` subtree.
- Wrap geographic coordinates in the same `datum` you pass to the scene, otherwise markers drift by the datum offset.

## Disposal checklist

Every effect, picker, rotator, and loaded model must be released:

```ts
import { disposeDRACOLoader, disposeModel } from 'three-vue3'

disposeModel(gltf)        // geometry, materials, textures, then removes from parent
disposeDRACOLoader()      // only when no other loader needs it
```

- `<tv-rain>`, `<tv-snow>`, `Picker`, `ModelRotator`, and `SkyDome` dispose themselves when the component unmounts.
- Manually created classes in `@created` must be disposed in `onBeforeUnmount`.
- Do not dispose the renderer or the scene returned by `useScene()`; `<tv-scene>` owns them.

## Constraints

- Dual renderer: everything must run on `WebGPURenderer` and on `WebGLRenderer` (via `WebGLNodesHandler`). Author effects as TSL node materials; do not add GLSL `ShaderMaterial`s.
- When shading by hand, remember WebGPU output is linear; r3l effects apply a `pow(color, 2.2) * 0.86` pre-correction when `renderer.isWebGPURenderer`.
- Do not hard-code canvas dimensions; let `<tv-scene>` observe the container with `ResizeObserver`.
- Colors are managed by three; do not manually convert sRGB unless the shader explicitly bypasses color management.
- Model URLs must resolve without a server rewrite. The loader resolves relative paths against `document.baseURI`.
- Draco models need `:draco="true"` on the component or `{ draco: true }` on the loader function.

## Project commands

From the library root:

```bash
npm run dev
npm run build-only
npm run test:unit
npm run docs:dev
```

Docs live in `docs/docs`; a full-screen demo is at `/demo`.
