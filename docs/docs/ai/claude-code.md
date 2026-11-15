---
lang: en-US
title: Claude Code
---

Claude Code loads personal skills from `~/.claude/skills`.

## Install

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

## Verify

```bash
ls ~/.claude/skills/three-vue3/SKILL.md
```

Start a new session and ask it to scaffold a scene with `<tv-scene>`. The answer should mention `@created` and `FitCamera` without reading the repository.
