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

## Versioning

Determine the next version from the latest released tag before preparing a
release. Tags and changelog headings both use the `x.y.z` form with no `v`
prefix, matching the `version` in `package.json` and the `*.*.*` trigger of
[create-release.yml](.github/workflows/create-release.yml).

1. **Find the latest tag.** Run `git fetch --tags origin` and then
   `git ls-remote --tags --sort='-v:refname' origin`. Select the first tag that
   exactly matches `x.y.z`, ignoring annotated-tag `^{}` entries. Use
   `ls-remote` rather than `git describe` because sandbox checkouts are often
   shallow and cannot walk back to older tags and because the workflow is driven
   by the pushed tag, not by local history.

2. **Choose the bump.** Increment the patch (`x.y.z+1`) for fixes, refactors and
   documentation; the minor (`x.y+1.0`) for new features; the major (`x+1.0.0`)
   for breaking changes to the public API.

3. **Use it consistently.** Feed the resulting `x.y.z` into the Releasing steps
   below so `package.json`, the `CHANGELOG.md` heading, and the git tag all carry
   the same version.

## Releasing

When the user defines a release version (`x.y.z`) or asks for the next version,
execute these steps in this exact order. Do not stop halfway and do not reorder
them:

1. **Add the changelog entry.** Update `CHANGELOG.md`: prepend
   `## [x.y.z] - YYYY-MM-DD` with the release notes, keep the `---` separator
   used between entries, and set the same version in `package.json` so
   `package.json` and `CHANGELOG.md` stay in sync.

2. **Commit and push to `development`.** Commit the release preparation as
   `chore: release version x.y.z` and push it (`git push origin development`).

3. **Create and merge the pull request to `main`.** Create the release pull
   request with:

   ```bash
   gh pr create --base main --head development --title "chore: release version x.y.z" --body "..."
   ```

4. **Publish the tag.** After the pull request is merged, tag the merged commit
   as `x.y.z` and push the tag (`git tag x.y.z && git push origin x.y.z`). This
   triggers [create-release.yml](.github/workflows/create-release.yml), which
   builds the library, creates the GitHub Release, uploads `three-vue3.zip`,
   publishes to npm via GitHub OIDC trusted publishing (`id-token: write`, no
   `NPM_TOKEN` secret), and deploys the documentation to GitHub Pages. The
   package's trusted publisher on npmjs.com must point at this repository and
   `create-release.yml`. The tag must match `*.*.*` and equal the `version` in
   `package.json`; never re-tag an already published version.

## Pull requests

- Do feature work on a temporary branch; never commit directly to `main` or
  `develop`.
- Open the pull request against `develop` and merge it.
- After the pull request is merged, delete the temporary branch both locally
  and on the remote: `git branch -d <branch>` and
  `git push origin --delete <branch>`. Confirm with `git branch -a` and
  `git ls-remote --heads origin`.

## Do not

- Do not commit `dist/` output or edit generated bundles.
- Do not bump the version in `package.json` or edit `CHANGELOG.md` unless asked;
  releases are handled by `.github/workflows/create-release.yml`.
