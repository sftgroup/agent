# Quickstart: Git / Build / Solana MCP + Skills

三个 MCP 服务 + 对应 Skill，让 OpenClaw agent 通过 MCP 协议远程执行 git 操作、构建、和 Solana 合约部署。

---

## 前置条件

- OpenClaw Gateway 已运行
- 能访问 MCP 服务器 `43.156.46.187`（端口 3080/3081/3082）
- 有 `sftgroup/agent` 仓库访问权限

---

## 1. 安装 Skill

```bash
# 从 agent repo 克隆 skills
git clone https://github.com/sftgroup/agent.git /tmp/agent-skills

# 安装三个 skill
openclaw skills install /tmp/agent-skills/skills/git-operations
openclaw skills install /tmp/agent-skills/skills/build-operations
openclaw skills install /tmp/agent-skills/skills/solana-anchor
```

验证：

```bash
openclaw skills list | grep -E "git-operations|build-operations|solana-anchor"
```

三个都应显示 `✓ ready`。

---

## 2. 配置 MCP Server

编辑 `~/.openclaw/openclaw.json`，在 `mcp.servers` 下添加：

```json
{
  "mcp": {
    "servers": {
      "git": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3082"
      },
      "build": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3081"
      },
      "solana-build": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3080"
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
- git: 19 tools
- build: 6 tools
- solana-build: 6 tools
```

---

## 3. 修改 AGENTS.md

在 agent 的 AGENTS.md 中加入以下规则（无需 tool 列表，OpenClaw 自动发现）：

```markdown
## MCP 工具使用规则

本 agent 接入中心 MCP 服务器（43.156.46.187），**禁止绕开 MCP 直接裸用 shell 命令**。

### 提交流程（严格 4 步）

```
git_pull  → git_status  → repo_check  → git_push  → git_sync
```

- commit message 必须 `type(scope): 做了什么` + body（为什么、改了哪些文件）
- 禁止 force push（除非 stevenwang 明确要求）
- 禁止跳过 repo_check 直接 push

### 构建

```
❌ 禁止 exec pnpm build / npm build / docker build / cargo build-sbf
✅ 必须通过 build-mcp：build_npm / build_docker / build_mobile
```

### Solana 合约

```
❌ 禁止 exec cargo build-sbf / solana program deploy
✅ 必须通过 solana-mcp：solana_build / solana_deploy
❌ 禁止硬编码私钥，禁止在回复中暴露私钥
```

### 永远不要

| ❌ 禁止 | ✅ 替代 |
|----------|---------|
| exec git push/pull/clone | git-mcp |
| exec pnpm build | build-mcp |
| exec docker build | build-mcp |
| exec cargo build-sbf | solana-mcp |
| 写 "fix bug" / "update" 等模糊 message | type(scope): 详细说明 |
| 构建未提交/未 review 的代码 | 先 push + review |
```

> 完整参考：`sftgroup/agent/agents/team5/AGENTS.md`

---

## 4. 验证

重启 Gateway 后，在对话中直接测试：

```
# agent 应该能直接调用这些 tool：
git__repo_list          — 列出所有仓库
build__build_disk       — 查看构建磁盘
solana-build__solana_history — 查看部署历史
```

如果都能正常返回数据，MCP 集成成功。

---

## 架构

```
Agent (飞书/Discord)
  │
  │  MCP JSON-RPC (POST / over HTTP)
  ▼
┌─────────────────────────────────────────────────────┐
│  43.156.46.187                                       │
│                                                       │
│  :3080  solana-mcp    build/balance/verify/history   │
│  :3081  build-mcp     npm/docker/mobile/clean/disk   │
│  :3082  git-mcp       pull/push/sync/check/repo_pull │
└─────────────────────────────────────────────────────┘
```

| MCP Server | Tools | Skill |
|---|---|---|
| git (3082) | 19 个 — git 全生命周期 | git-operations |
| build (3081) | 6 个 — npm/docker/mobile | build-operations |
| solana-build (3080) | 6 个 — SBF 编译/部署/查询 | solana-anchor |

> Agent 不需要安装 Git/Solana CLI/Docker 等本地工具链，一切通过 MCP 远程执行。
