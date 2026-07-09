# OpenClaw Instance Doctor — Apply 指南

## 概述

instance-doctor 是纯脚本 Skill（没有 MCP）。它不需要部署服务器，不需要注册 MCP tool。直接用。

## 其他 Agent 如何 Apply

### Step 1: 复制 Skill 文件

```bash
git clone git@github.com:sftgroup/agent.git /tmp/agent-repo
cp -r /tmp/agent-repo/skills/openclaw-instance-doctor ~/.openclaw/skills/openclaw-instance-doctor
```

### Step 2: 安装依赖

```bash
sudo apt-get install -y sshpass
```

### Step 3: 验证

```bash
# 本地自检
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/diagnose.sh
# 输出缓存命中链评分 x/7
```

### Step 4: 修改 AGENTS.md

在 agent 的 AGENTS.md 中加入以下内容：

```markdown
## 自检规则

当收到"巡检""诊断""检查配置""看看有没有问题"等任务时：
1. 运行 diagnose.sh 获取 8 维报告
2. 重点关注缓存链评分（需要=7/7）
3. 如有配置偏移，运行 fix-config.sh 修复
4. 修复后重启 Gateway 并重新诊断确认

## 其他实例巡检

当需要检查其他实例时：
1. SSH 到目标机器（ubuntu / 凭证从 ~/.openclaw/skills/openclaw-instance-doctor/SKILL.md 获取）
2. 通过 SSH heredoc 远程执行 diagnose.sh
3. 汇总报告，标注偏离项和严重度
4. 征得 stevenwang 同意后执行 fix-config.sh
```

## 工作流模板

### 自检

```bash
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/diagnose.sh
# → 缓存命中链: 7/7 ✅ → 无需操作
# → 缓存命中链: 3/7 ❌ → 继续修复
```

### 修复

```bash
openclaw gateway stop
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/fix-config.sh
openclaw gateway start
```

### 远程巡检

```bash
sshpass -p 'Asdf1234!' ssh -o StrictHostKeyChecking=no ubuntu@<IP> 'bash -s' < ~/.openclaw/skills/openclaw-instance-doctor/scripts/diagnose.sh
```

## AGENTS.md 优化指南

### 原则

1. **不改 Skill 已有的内容** — SKILL.md 已经定义了诊断维度和修复逻辑，AGENTS.md 只定义**何时触发、用什么脚本、改完后做什么**
2. **最小侵入** — 只加一段，不重构整个 AGENTS.md
3. **用 Skill 引用，不重复写参数** — "按 SKILL.md 中的基准卡执行" > "contextInjection=always, cacheRetention=long, ..."

### 推荐的 AGENTS.md 片段

```markdown
## 🔧 实例巡检

触发词：巡检、诊断、检查配置、缓存打不中、响应变慢

流程：
1. 执行 `scripts/diagnose.sh` → 缓存链评分
2. 评分 < 7 → 列出偏离项 → 征得 stevenwang 同意
3. 停 Gateway → 执行 `scripts/fix-config.sh` → 重启
4. 重新诊断 → 确认 7/7
5. 汇报修复项目 + 前后对比

凭证和配置基准见 `SKILL.md`。
```

## 凭证管理

| 环境 | 用户 | 密码 |
|------|------|------|
| 全部实例 | ubuntu | Asdf1234! |

凭证在 SKILL.md 中已定义，AGENTS.md 不需要重复写。

## 与其他 Skill 的关系

| Skill | 关系 |
|-------|------|
| instance-doctor | **本 Skill** — 实例配置和健康 |
| code-review-toolkit | 独立 — 代码质量 |
| git-operations | 独立 — 代码管理 |

instance-doctor 不依赖其他 Skill。它只读 `openclaw.json`，不读项目代码。

## 验证清单

- [ ] `skills/openclaw-instance-doctor/` 已复制到 `~/.openclaw/skills/`
- [ ] `sshpass` 已安装
- [ ] 本地 `diagnose.sh` 可执行
- [ ] AGENTS.md 已加入触发规则
- [ ] 自检缓存链 = 7/7
