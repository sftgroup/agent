# Quickstart: EVM MCP + Skill

EVM 多链操作 MCP 服务 + evm-toolkit Skill，让 OpenClaw agent 通过 MCP 协议远程执行 cast/forge 替代操作。

---

## 前置条件

- OpenClaw Gateway 已运行
- 能访问 MCP 服务器 `43.156.46.187`（端口 3400）
- 有 `sftgroup/agent` 仓库访问权限

---

## 1. 安装 Skill

```bash
git clone https://github.com/sftgroup/agent.git /tmp/agent-skills
openclaw skills install /tmp/agent-skills/skills/evm-toolkit
```

验证：

```bash
openclaw skills list | grep evm-toolkit
# 应显示 ✓ ready
```

---

## 2. 配置 MCP Server

编辑 `~/.openclaw/openclaw.json`，在 `mcp.servers` 下添加：

```json
{
  "mcp": {
    "servers": {
      "evm-build": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3400"
      }
    }
  }
}
```

> ⚠️ 不要加 `tools` 白名单 —— OpenClaw 会自动通过 `tools/list` 发现所有工具。

重启 Gateway 使之生效：

```bash
openclaw gateway restart
```

验证：

```bash
openclaw mcp probe
```

应看到：

```
- evm-build: 9 tools
```

---

## 3. 修改 AGENTS.md

在 agent 的 AGENTS.md 中加入以下规则：

```markdown
## ⛓️ EVM 操作

链上操作全部走 MCP（43.156.46.187:3400），直接调用 `evm-build__*` 工具。
OpenClaw 初始化时自动拉取 tool 列表，无需手动注册。

> 私钥只在 MCP 服务器上。Skill `evm-toolkit` 仅用作链 ID/Gas 速查表。

### 9 个工具

| 调用方式 | 工具 | 用途 | 风险 |
|----------|------|------|:--:|
| evm-build__evm_status | evm_status | 区块/gas/余额/nonce | 📖 |
| evm-build__evm_call | evm_call | eth_call 只读 | 📖 |
| evm-build__evm_send | evm_send | 发交易 | ✍️ |
| evm-build__evm_deploy | evm_deploy | 编译+部署+验证 | ✍️ |
| evm-build__evm_verify | evm_verify | Explorer 验证 | 📖 |
| evm-build__evm_logs | evm_logs | 事件日志 | 📖 |
| evm-build__evm_token | evm_token | ERC20 操作 | ✍️ |
| evm-build__evm_gas_preset | evm_gas_preset | Gas 建议 | 📖 |
| evm-build__evm_registry | evm_registry | 部署历史 | 📖 |

### 永远不要

| ❌ 禁止 | ✅ 替代 |
|----------|---------|
| exec cast send/call | `evm-build__evm_send` / `evm-build__evm_call` |
| exec forge build/test | `evm-build__evm_deploy` |
| exec cast logs | `evm-build__evm_logs` |
| 硬编码私钥/RPC URL | 环境变量 + MCP |
```

## 4. Agent 优化方案

### 4.1 主 agent (team4) AGENTS.md — MCP 工具使用规则

完整参考：`sftgroup/agent/agents/team5/AGENTS.md`

在 AGENTS.md 的 MCP 规则段统一管理所有 MCP server 的禁止替代规则：

```markdown
## 🔧 MCP 工具使用规则

本 agent 接入中心 MCP 服务器（43.156.46.187），**禁止绕开 MCP 直接裸用 shell 命令**。

### Git（git-operations skill）
提交流程：`git_pull → git_status → repo_check → git_push → git_sync`

### 构建（build-operations skill）
❌ exec pnpm/npm/docker build → ✅ `build__*` MCP

### EVM（evm-toolkit skill）
❌ exec cast/forge → ✅ `evm-build__*` MCP

### Solana（solana-anchor skill）
❌ exec cargo build-sbf / solana program deploy → ✅ `solana-build__*` MCP

### 永远不要
| ❌ 禁止 | ✅ 替代 |
|----------|---------|
| exec git push/pull/clone | `git__*` MCP |
| exec pnpm/npm build | `build__*` MCP |
| exec docker build | `build__*` MCP |
| exec cargo build-sbf | `solana-build__*` MCP |
| exec cast/forge | `evm-build__*` MCP |
| 硬编码私钥/RPC URL | 环境变量 + MCP |
```

### 4.2 子 agent 优化

以下子 agent 需要更新，去掉硬编码的 RPC/私钥/本地 CLI 引用：

#### tester/AGENTS.md
替换为 MCP 版（使用 autotest-web3__*/autotest-web__*/autotest-dapp__* 工具）：
```bash
curl -o ~/.openclaw/workspace/tester/AGENTS.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/AGENTS.md
```

#### security/AGENTS.md
去掉 `Infura RPC 环境变量` 段，替换为：
```markdown
## 链上操作
> 合约验证/链上查询通过 `evm-build__*` MCP 工具，无需本地 RPC 环境变量。
```

### 4.3 注册 tester agent

在 `openclaw.json` 中：

```json
{
  "agents": {
    "tester": {
      "agentId": "tester",
      "model": "deepseek/deepseek-v4-pro",
      "workspace": "~/.openclaw/workspace/tester",
      "toolsAllow": ["autotest-*"]
    }
  }
}
```

## 5. 验证

重启 Gateway 后，在对话中直接测试：

```
evm-build__evm_status(chain="eth")        — ETH 区块/gas
evm-build__evm_gas_preset(chain="bsc")    — BSC 推荐 gas
evm-build__evm_registry()                 — 部署历史
```

如果都能正常返回数据，EVM MCP 集成成功。

---

## 架构总览

```
Agent (飞书/Discord)
  │
  │  MCP JSON-RPC (streamable-http / SSE)
  ▼
┌──────────────────────────────────────────────────────────────────┐
│  43.156.46.187                                                     │
│                                                                   │
│  :3400  evm-mcp       cast/forge/contract deploy (9 tools)       │
│  :3082  git-mcp       pull/push/sync/check (19 tools)            │
│  :3081  build-mcp     npm/docker/mobile (6 tools)                │
│  :3080  solana-mcp    SBF build/deploy/query (6 tools)           │
│  :8081  autotest-web3 合约测试+安全审计 (21 tools)                │
│  :8082  autotest-web  API/浏览器/性能测试 (18 tools)              │
│  :8083  autotest-dapp DApp 链上+UI 测试 (8 tools)                │
└──────────────────────────────────────────────────────────────────┘
```

| MCP Server | Port | Transport | Tools | Skill |
|---|---|---|---|---|
| evm-build | 3400 | streamable-http | 9 | evm-toolkit |
| git | 3082 | streamable-http | 19 | git-operations |
| build | 3081 | streamable-http | 6 | build-operations |
| solana-build | 3080 | streamable-http | 6 | solana-anchor |
| autotest-web3 | 8081 | sse | 21 | autotest-mcp |
| autotest-web | 8082 | sse | 18 | autotest-mcp |
| autotest-dapp | 8083 | sse | 8 | autotest-mcp |

> Agent 不需要安装 cast/forge/solana/docker 等本地工具链，一切通过 MCP 远程执行。
