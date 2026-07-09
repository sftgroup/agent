# OpenClaw Instance Doctor — 新机接入指南

## 前置条件

- 目标机器可 SSH 访问（ubuntu / Asdf1234!）
- 已安装 OpenClaw（`openclaw --version`）
- 模型 API key 已配置

## 接入流程

### Step 1: 远程诊断

```bash
# 从任意可达目标机器的节点执行
sshpass -p 'Asdf1234!' ssh -o StrictHostKeyChecking=no ubuntu@<目标IP> 'bash -s' < scripts/diagnose.sh
```

输出包含：
- 基础信息（hostname, openclaw 版本, node 进程, 磁盘, uptime）
- 主 AGENTS.md 存在性 + 行数
- 9 个子 agent 清单（qa/security/security-check/...）
- 旧版残留检测（workspaces/ vs agents/）
- Config 详情（15 项逐行打印）
- **缓存命中链完整性评分（7/7）**
- 浏览器清理脚本 + crontab
- 磁盘使用 TOP 8 + 缓存目录大小

### Step 2: 对比基准

对照 `references/baseline.md` 中的 15 项标准，逐一比对诊断输出。重点关注：

| 优先级 | 检测项 | 影响 |
|--------|--------|------|
| P0 | cacheRetention / heartbeat / contextPruning | 缓存命中率直接下降 |
| P0 | contextInjection | prefix 波动 → 每次重新缓存 → 额外 token 消耗 |
| P1 | 子 agent 清单 | 缺 agent 则路由失败 |
| P1 | 旧版 workspaces/ | 磁盘浪费 + 路径混乱 |
| P2 | compaction 参数 | 压缩频率过高/过低 |
| P2 | session mgmt | 旧 session 堆积 |

### Step 3: 修复

```bash
# 停止 Gateway
openclaw gateway stop

# 等待 5 秒确认停止
sleep 5

# 执行修复（11 项检查，自动对齐）
sshpass -p 'Asdf1234!' ssh -o StrictHostKeyChecking=no ubuntu@<目标IP> 'bash -s' < scripts/fix-config.sh

# 重启 Gateway
openclaw gateway start
```

fix-config.sh 修复清单：
1. `contextInjection` → always
2. `skipOptionalBootstrapFiles` → correct set
3. `compaction` → 5 参数对齐
4. `deepseek.timeoutSeconds` → 300
5. `gateway.bind` → lan
6. `cacheRetention` → long
7. `heartbeat.every` → 55m
8. `contextPruning` → cache-ttl / 1h
9. `bootstrapTotalMaxChars` → 50000
10. `session.reset` / `session.maintenance` → 设置
11. 清理不在标准列表中的 agent

### Step 4: 验证

```bash
# 重新诊断
sshpass -p 'Asdf1234!' ssh -o StrictHostKeyChecking=no ubuntu@<目标IP> 'bash -s' < scripts/diagnose.sh

# 预期输出: 缓存命中链完整度: 7/7
```

## 常见问题

### Q: 修复后缓存命中率多久恢复？
A: 第一个请求重新建缓存（cache-write），之后稳定命中。heartbeat 每 55 分钟保活一次，不会过期。

### Q: 为什么 contextPruning 设 1h？
A: 与 OpenRouter cache_control TTL 对齐。超出 1h 的旧 tool 结果缓存也无法命中，不如尽早清理减少请求体。

### Q: 为什么不删除 agents/ 目录？
A: `~/.openclaw/agents/` 是运行时存储（sqlite + sessions），删除会丢失会话历史。只清理 `workspaces/`（旧版目录）。

### Q: 磁盘清理脚本安全吗？
A: `cleanup-disk.sh` 只清理包管理缓存（npm/pnpm/pip/apt/go）+ 系统日志 + /tmp。不碰项目代码和数据文件。

## 凭证管理

所有脚本通过 SSH heredoc 执行，不需要在目标机上部署文件。密码通过 sshpass 传入。

| 环境 | 用户 | 密码 |
|------|------|------|
| 全部 | ubuntu | Asdf1234! |

## 实例清单

| IP | Team | 状态 |
|----|------|------|
| 43.156.50.6 | team3 | ✅ baseline |
| 43.156.55.212 | team2 | ✅ aligned |
| 43.159.60.46 | team4 | ✅ aligned |
| 129.226.203.60 | team6 | ✅ aligned |
| 43.156.138.166 | team1 | 🔲 待诊断 |
| 43.133.37.213 | team3-backup | 🔲 待诊断 |
| 124.156.203.132 | team5 | 🔲 待诊断 |

## 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 07-10 | v2.0 | 缓存命中链优化：+cacheRetention/heartbeat/contextPruning/bootstrapTotalMaxChars（4 项 → 15 项） |
| 07-09 | v1.0 | 初始版：10 维度诊断 + 4 阶段对齐 |
