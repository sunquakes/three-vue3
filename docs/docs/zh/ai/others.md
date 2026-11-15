---
lang: zh-CN
title: 其他智能体
---

遵循 `~/.agents/skills` 约定的智能体可以直接使用同一个压缩包。

## 安装

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

## 安装到项目内

部分智能体只读取仓库内的技能。此时把同一目录复制进项目即可：

```bash
mkdir -p .agents/skills
unzip -o three-vue3.zip -d .agents/skills
```

如果希望团队共享，可以提交 `.agents/skills/three-vue3/`。

## 验证

```bash
ls .agents/skills/three-vue3/SKILL.md
```
