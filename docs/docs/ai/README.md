---
lang: en-US
title: AI Agents
---

::: tip type
Skill
:::

Three Vue3 ships an AI agent skill that teaches coding assistants the library's API, component/class split, and cleanup rules. Install it once and every new session already knows how to build a scene, load a model, pick objects, and dispose resources correctly.

## What the skill covers

- The `<tv-scene>` golden path with `@created` and the `v-model:*` props
- Component vs. class usage (`tv-gltf-loader` vs. `GLTFLoader()`, `<tv-rain>` vs. `RainEffect`)
- Camera framing with `FitCamera`, picking with `Picker`, rotation with `ModelRotator`
- Shared sun direction through `globalParameterBus` and `SkyDome`
- Disposal: `disposeModel`, `disposeDRACOLoader`, and effect `dispose()`
- WebGPU and WebGL rendering through TSL node materials, switched with the `renderer-type` prop on `<tv-scene>`

## Why install it in your home folder

Skills live in a per-user directory, not in each project. Installing once means the agent picks it up in every repository, and project files stay free of assistant-specific configuration.

## Install

Pick the page for your agent:

- [Claude Code](/ai/claude-code.md) — `~/.claude/skills`
- [Codex CLI](/ai/codex-cli.md) — `~/.codex/skills`
- [DeepSeek Harness](/ai/deepseek-harness.md) — `~/.dsh/skills`
- [Other agents](/ai/others.md) — `~/.agents/skills`

Download the skill archive: [three-vue3.zip](/skills/three-vue3.zip)

The archive contains a single `three-vue3/` folder with `SKILL.md` at its root. Unzip it into the skills directory so the path ends with `three-vue3/SKILL.md`.

## Sample prompts

```text
Add a three-vue3 scene that loads /models/perseverance.glb, frames it with FitCamera,
and rotates it slowly with ModelRotator.
```

```text
The rain effect keeps running after I leave the page. Audit the component for missing disposal.
```

```text
Add hover highlighting to my GLB model using Picker and restore the original material color on leave.
```

## Verification checklist

- The skills directory contains `three-vue3/SKILL.md` with valid frontmatter.
- A new agent session can answer "which component renders rain?" without browsing the repo.
- Generated code uses `<tv-scene>` and `@created`, not `onMounted` + a manual renderer.
- Generated teardown calls `dispose()` on effects, pickers, and loaded models.
