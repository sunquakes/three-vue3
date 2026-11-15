---
lang: en-US
title: DeepSeek Harness
---

DeepSeek Harness loads personal skills from `~/.dsh/skills`.

## Install

### bash

```bash
mkdir -p ~/.dsh/skills
curl -L https://three-vue3.sunquakes.com/skills/three-vue3.zip -o /tmp/three-vue3.zip
unzip -o /tmp/three-vue3.zip -d ~/.dsh/skills
```

### PowerShell

```powershell
New-Item -ItemType Directory -Force "$HOME\.dsh\skills" | Out-Null
Invoke-WebRequest -Uri "https://three-vue3.sunquakes.com/skills/three-vue3.zip" -OutFile "$env:TEMP\three-vue3.zip"
Expand-Archive -Path "$env:TEMP\three-vue3.zip" -DestinationPath "$HOME\.dsh\skills" -Force
```

## Verify

```bash
ls ~/.dsh/skills/three-vue3/SKILL.md
```

Start a new session and ask it to audit a scene for missing disposal calls.
