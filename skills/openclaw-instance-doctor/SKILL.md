---
name: openclaw-instance-doctor
description: "诊断+对齐 OpenClaw 实例：缓存命中链（15项配置）、会话管理、磁盘、浏览器。含诊断脚本+修复脚本+基准卡。7 台实例已验证 4 台。"
---

# OpenClaw Instance Doctor

统一诊断和修复 OpenClaw 多实例集群的配置偏移。核心能力：**缓存命中链完整性检查**（7/7 评分卡）+ **一键对齐基准**（fix-config.sh 含 11 项检查）。

## 适用场景

- 新机器接入集群 → 对齐 benchmark
- 旧实例定期巡检 → 发现配置偏移
- 升级/迁移后 → 验证 config 完整性
- 性能变慢 → 排查缓存命中率

## 配置基准总览（15 项）

### 缓存命中链 ⭐

| # | Config | Baseline | 作用 |
|---|--------|----------|------|
| 1 | `contextInjection` | `always` | 稳定前缀 → cache prefix 不变 |
| 2 | `cacheRetention` | `long` | DeepSeek via OpenRouter 1h TTL |
| 3 | `heartbeat.every` | `55m` | 保活，在 TTL 过期前续命 |
| 4 | `contextPruning.mode` | `cache-ttl` | 旧 tool 结果按 TTL 清理 |
| 5 | `contextPruning.ttl` | `1h` | 与 cache TTL 对齐 |
| 6 | `skipOptionalBootstrapFiles` | `[SOUL,HEARTBEAT,IDENTITY,USER]` | 无 404 → 前缀稳定 |
| 7 | `bootstrapTotalMaxChars` | `50000` | 容纳 10 个 agent 的 AGENTS.md |
| 8 | `compaction.reserveTokens` | `12000` | 压缩后预留 12K |
| 9 | `compaction.keepRecentTokens` | `20000` | 保留最近 20K 不压缩 |
| 10 | `compaction.maxHistoryShare` | `0.6` | 历史最多占 60% 窗口 |
| 11 | `compaction.recentTurnsPreserve` | `3` | 最近 3 轮完整保留 |
| 12 | `compaction.notifyUser` | `true` | 压缩时通知用户 |
| 13 | `gateway.bind` | `lan` | 局域网可访问 |
| 14 | `session.reset` | `idle/480m` | 8h 空闲重置 |
| 15 | `session.maintenance` | `enforce/30d/1000` | 自动清理旧 session |

### 完整基准卡 → `references/baseline.md`

包含：15 项配置详解 + 缓存命中链流程图 + 浏览器/磁盘维护策略 + 实例清单。

## 接入步骤

```
1. 连接    ssh 到目标机器
2. 诊断    bash diagnose.sh → 输出 8 维报告 + 缓存链评分 (x/7)
3. 对比    对照 baseline.md 生成差距表
4. 确认    用户审批每个待修复项
5. 修复    stop gateway → bash fix-config.sh → restart
6. 验证    重跑 diagnose.sh → 确认 7/7
```

## 文件结构

```
skills/openclaw-instance-doctor/
├── SKILL.md                        ← 本文件
├── references/
│   ├── readme-human.md             ← 人话说明（干嘛的、为什么、效果）
│   ├── apply-guide.md              ← Apply 指南（Agent 如何接入 + AGENTS.md 优化）
│   ├── baseline.md                 ← 配置基准卡（15 项）
│   ├── onboarding-guide.md         ← 新机接入指南
│   └── mcp-deployment-guide.md     ← MCP 部署规范（端口、目录、systemd）
└── scripts/
    ├── diagnose.sh                 ← 诊断（8 维 + 缓存链评分）
    ├── fix-config.sh               ← 一键修复（11 项检查）
    ├── cleanup-disk.sh             ← 磁盘清理
    └── restart-gateway.sh          ← 安全重启
```

## Credentials

| Key | Value |
|-----|-------|
| User | ubuntu |
| Password | Asdf1234! |
| SSH | `sshpass -p '<PASS>' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@<IP>` |

## 已验证实例

| IP | Team | 缓存链 | 日期 |
|----|------|--------|------|
| 43.156.50.6 | team3 | 7/7 ✅ | 07-10 |
| 43.156.55.212 | team2 | aligned ✅ | 07-09 |
| 43.159.60.46 | team4 | aligned ✅ | 07-09 |
| 129.226.203.60 | team6 | aligned ✅ | 07-09 |
| 43.156.138.166 | team1 | 待诊断 | — |
| 43.133.37.213 | team3-backup | 待诊断 | — |
| 124.156.203.132 | team5 | 待诊断 | — |
