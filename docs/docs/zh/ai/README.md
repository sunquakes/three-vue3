---
lang: zh-CN
title: AI 智能体
---

::: tip 类型
技能
:::

Three Vue3 提供了一个 AI 智能体技能包，让编程助手掌握本库的 API、组件与类的分工以及资源释放规则。安装一次之后，每个新会话都无需再阅读源码，就能正确搭建场景、加载模型、拾取对象并释放资源。

## 技能覆盖内容

- `<tv-scene>` 的标准用法，配合 `@created` 与 `v-model:*` 属性
- 组件与类的区别（`tv-gltf-loader` 与 `GLTFLoader()`、`<tv-rain>` 与 `RainEffect`）
- 使用 `FitCamera` 取景、`Picker` 拾取、`ModelRotator` 旋转
- 通过 `globalParameterBus` 与 `SkyDome` 共享太阳方向
- 资源释放：`disposeModel`、`disposeDRACOLoader` 以及效果的 `dispose()`
- WebGPU 与 WebGL 双渲染：基于 TSL 节点材质，通过 `<tv-scene>` 的 `renderer-type` 属性切换

## 为什么安装在用户目录

技能存放在用户级目录而非每个项目中。安装一次即可在所有仓库中生效，项目文件也不会混入助手专用的配置。

## 安装

选择对应的智能体页面：

- [Claude Code](/zh/ai/claude-code.md) — `~/.claude/skills`
- [Codex CLI](/zh/ai/codex-cli.md) — `~/.codex/skills`
- [DeepSeek Harness](/zh/ai/deepseek-harness.md) — `~/.dsh/skills`
- [其他智能体](/zh/ai/others.md) — `~/.agents/skills`

下载技能包：[three-vue3.zip](/skills/three-vue3.zip)

压缩包中只有一个 `three-vue3/` 目录，`SKILL.md` 位于其根目录。请解压到技能目录，使路径最终为 `three-vue3/SKILL.md`。

## 示例提示词

```text
用 three-vue3 添加一个场景，加载 /models/perseverance.glb，
用 FitCamera 取景，并用 ModelRotator 缓慢旋转。
```

```text
离开页面后雨效仍在运行。请检查组件中缺失的资源释放逻辑。
```

```text
用 Picker 为我的 GLB 模型添加悬停高亮，并在移出时恢复材质原色。
```

## 验证清单

- 技能目录中存在带有合法 frontmatter 的 `three-vue3/SKILL.md`。
- 新的智能体会话无需浏览仓库即可回答“哪个组件负责下雨效果？”。
- 生成的代码使用 `<tv-scene>` 与 `@created`，而不是 `onMounted` 加手动渲染器。
- 生成的清理代码会对效果、拾取器和已加载模型调用 `dispose()`。
