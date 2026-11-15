# AGENTS.md

Guidance for coding agents working in this repository.

## What this repo is

`three-vue3` is a Vue 3 component library around `three`. Components are renderless: they inject the scene runtime and attach three.js objects, while `<tv-scene>` owns the renderer, camera, light, and controls. The docs site is VuePress 2 and lives in `docs/`.

## Layout

- `src/components/` — Vue components (`Scene`, `GLTFLoader`, `Rain`, `Snow`, `Bloom`, `HeightFog`, ...)
- `src/utils/` — runtime classes (`Scene`, `Renderer`, `Picker`, `ModelRotator`, `FitCamera`, `SkyDome`, `RainEffect`, `SnowEffect`, `ParameterBus`, `ModelLoader`)
- `src/effects/` — TSL effect classes shared by components and demos
- `src/meshes/` — TSL mesh classes (`FlowLineMesh`, `WaveCircleMesh`)
- `src/crs/` — geographic helpers (`GeoReference`, `Mercator`, `Datum`, `TilePyramid`, `Tiles`, `GeoJson`)
- `src/context/` — `useScene` / `useFrame` injection helpers
- `src/index.ts` — plugin registration and public exports
- `src/__tests__/` — Vitest unit tests
- `docs/docs/` — documentation source, `docs/docs/.vuepress/` — site config and demo components
- `.agents/skills/three-vue3/SKILL.md` — AI agent skill distributed from the docs site

## Commands

Run from the repository root:

```bash
npm run dev          # library dev server
npm run build-only   # type-check plus Vite build
npm run test:unit    # Vitest
npm run docs:dev     # VuePress dev server
npm run docs:build   # VuePress build
```

The docs package resolves `three-vue3` from `file:../`, so rebuild the library after changing `src/` before checking docs output.

## Conventions

- TypeScript, Vue 3 `defineComponent` for components, `<script setup lang="ts">` for demos.
- Prettier: no semicolons, single quotes, 2-space indent, trailing commas where the printer adds them.
- Import three modules by path (`three`, `three/examples/jsm/...`); do not add a second three installation.
- New components register as `tv-<name>` in `src/index.ts`, and their props mirror the matching class options.
- Dispose everything you create. Renderers and scenes are owned by `<tv-scene>`.
- Dual renderer: every effect must work on `WebGPURenderer` (default) and on `WebGLRenderer` through `WebGLNodesHandler`. Author shaders as TSL node materials, never raw GLSL.
- Public API changes must update `src/index.ts`, the docs page (EN + `zh/`), and the skill if the guidance changes.

## Verification

1. `npm run build-only` reports no `vue-tsc` errors.
2. `npm run test:unit` passes.
3. `npm run docs:build` succeeds, and the changed page renders.
4. The demo at `/demo` loads the model, frames it, and disposes cleanly on navigation.
