---
lang: zh-CN
title: DeepSeek Harness
---

DeepSeek Harness 从 `~/.dsh/skills` 加载个人技能。

## 安装

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

## 验证

```bash
ls ~/.dsh/skills/three-vue3/SKILL.md
```

开启新会话，让它检查某个场景是否遗漏了资源释放调用。
