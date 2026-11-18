English | [🇨🇳中文](https://github.com/sunquakes/three-vue3/blob/main/README_ZH.md)

# Three Vue3

<p align="center">
  <a href="https://three-vue3.sunquakes.com/" target="_blank" rel="noopener noreferrer">
    <img width="200" src="https://three-vue3.sunquakes.com/images/logo.png" alt="three-vue3 logo">
  </a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/node-%3E=18.20.6-brightgreen.svg?maxAge=2592000" alt="Node">
  <img alt="GitHub" src="https://img.shields.io/github/license/sunquakes/three-vue3?color=blue">
  <img alt="three-vue3" src="https://img.shields.io/github/v/release/sunquakes/three-vue3">
</p>

## Documentation

Visit [three-vue3.sunquakes.com](https://three-vue3.sunquakes.com).

- [Live demo](https://three-vue3.sunquakes.com/demo.html)
- [AI agent skill](https://three-vue3.sunquakes.com/ai/): install once, use in every repository

## Install

### Install `Three.js`

```bash
pnpm i three
```

### Install `three-vue3`

```bash
pnpm i three-vue3
```

## Getting Started

- Import the desired components from `three-vue3` in `main.js`.

```js
import ThreeVue3 from 'three-vue3'
Vue.use(ThreeVue3)
```

- Use it in `Vue 3` components.

```vue
<template>
  <tv-scene class="scene"></tv-scene>
</template>

<script lang="ts" setup></script>

<style>
.scene {
  margin-top: 10px;
  width: 100%;
  height: 300px;
}
</style>
```

## Features

- Scene, camera, lights and controls are created automatically.
- Models load from GLB/GLTF with IndexedDB caching and optional Draco decoding.
- `FitCamera`, `Picker` and `ModelRotator` cover framing, hover/click picking and turntable animation.
- `Rain`, `Snow` and `SkyDome` share a global sun direction through the parameter bus.
- `useScene` / `useFrame` expose the runtime to composition API components.

## License

[Apache-2.0 license](/LICENSE)
