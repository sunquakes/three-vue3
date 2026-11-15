---
lang: en-US
title: Codex CLI
---

Codex CLI loads personal skills from `~/.codex/skills`.

## Install

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

## Verify

```bash
ls ~/.codex/skills/three-vue3/SKILL.md
```

Restart the CLI, then ask it to add a `<tv-rain>` overlay to an existing scene.
