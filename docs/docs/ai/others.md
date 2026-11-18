---
lang: en-US
title: Other Agents
---

Agents that follow the shared `~/.agents/skills` convention can use the same archive.

## Install

### bash

```bash
mkdir -p ~/.agents/skills
curl -L https://three-vue3.sunquakes.com/skills/three-vue3.zip -o /tmp/three-vue3.zip
unzip -o /tmp/three-vue3.zip -d ~/.agents/skills
```

### PowerShell

```powershell
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null
Invoke-WebRequest -Uri "https://three-vue3.sunquakes.com/skills/three-vue3.zip" -OutFile "$env:TEMP\three-vue3.zip"
Expand-Archive -Path "$env:TEMP\three-vue3.zip" -DestinationPath "$HOME\.agents\skills" -Force
```

## Project-local install

Some agents only read skills from the repository. Copy the same folder into the project instead:

```bash
mkdir -p .agents/skills
unzip -o three-vue3.zip -d .agents/skills
```

Commit `.agents/skills/three-vue3/` if the whole team should share it.

## Verify

```bash
ls .agents/skills/three-vue3/SKILL.md
```
