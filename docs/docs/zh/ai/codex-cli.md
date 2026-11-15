---
lang: zh-CN
title: Codex CLI
---

Codex CLI 从 `~/.codex/skills` 加载个人技能。

## 安装

### bash

```bash
mkdir -p ~/.codex/skills
curl -L https://three-vue3.sunquakes.com/skills/three-vue3.zip -o /tmp/three-vue3.zip
unzip -o /tmp/three-vue3.zip -d ~/.codex/skills
```

### PowerShell

```powershell
New-Item -ItemType Directory -Force "$HOME\.codex\skills" | Out-Null
Invoke-WebRequest -Uri "https://three-vue3.sunquakes.com/skills/three-vue3.zip" -OutFile "$env:TEMP\three-vue3.zip"
Expand-Archive -Path "$env:TEMP\three-vue3.zip" -DestinationPath "$HOME\.codex\skills" -Force
```

## 验证

```bash
ls ~/.codex/skills/three-vue3/SKILL.md
```

重启 CLI，然后让它为现有场景添加 `<tv-rain>` 雨效。
