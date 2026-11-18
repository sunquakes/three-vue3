---
lang: zh-CN
title: Claude Code
---

Claude Code 从 `~/.claude/skills` 加载个人技能。

## 安装

### bash

```bash
mkdir -p ~/.claude/skills
curl -L https://three-vue3.sunquakes.com/skills/three-vue3.zip -o /tmp/three-vue3.zip
unzip -o /tmp/three-vue3.zip -d ~/.claude/skills
```

### PowerShell

```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Invoke-WebRequest -Uri "https://three-vue3.sunquakes.com/skills/three-vue3.zip" -OutFile "$env:TEMP\three-vue3.zip"
Expand-Archive -Path "$env:TEMP\three-vue3.zip" -DestinationPath "$HOME\.claude\skills" -Force
```

## 验证

```bash
ls ~/.claude/skills/three-vue3/SKILL.md
```

开启新会话，让它用 `<tv-scene>` 搭建场景。回答中应提到 `@created` 与 `FitCamera`，且无需读取仓库。
