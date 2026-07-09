# MCP 接入指南 — Agent 完整配置

> 将 OpenClaw agent 接入中心 MCP 服务器（43.156.46.187）的完整步骤。

---

## 第 1 步：安装 Skills

Skills 是 agent 的行为规范，告诉它什么场景该调哪个 MCP。安装到 OpenClaw 的 skills 目录：

```bash
# 拉取仓库
cd /tmp && git clone https://github.com/sftgroup/agent.git

# 安装所有 4 个 skill
cp -r agent/skills/solana-anchor       ~/.openclaw/skills/
cp -r agent/skills/git-operations      ~/.openclaw/skills/
cp -r agent/skills/build-operations    ~/.openclaw/skills/
cp -r agent/skills/code-review-toolkit ~/.openclaw/skills/
```

验证：
```bash
ls ~/.openclaw/skills/
# → build-operations  code-review-toolkit  git-operations  solana-anchor
```

---

## 第 2 步：注册 MCP Servers

编辑 `~/.openclaw/openclaw.json`（或 gateway 的 config.yaml），在 `tools.mcpServers` 中加入：

```json5
{
  "tools": {
    "mcpServers": {
      // ─── 代码管理 ───
      "git": {
        "type": "http",
        "url": "http://43.156.46.187:3082",
        "tools": [
          "repo_register", "repo_list", "repo_info", "git_create_repo",
          "git_clone", "git_pull", "git_push", "git_sync", "git_sync_status",
          "git_status", "git_tags", "git_create_tag", "git_log", "git_audit",
          "git_checkout", "repo_check",
          "repo_sync", "repo_snapshot"
        ]
      },

      // ─── 代码检查 ───
      "code-review": {
        "type": "http",
        "url": "http://43.156.46.187:9001",
        "tools": ["review_all", "review_lint", "review_format", "review_types", "review_complexity", "review_deps"]
      },

      // ─── 项目构建 ───
      "build": {
        "type": "http",
        "url": "http://43.156.46.187:3081",
        "tools": ["build_npm", "build_docker", "build_mobile", "build_status", "build_clean", "build_disk"]
      },

      // ─── Solana 合约 ───
      "solana-build": {
        "type": "http",
        "url": "http://43.156.46.187:3080",
        "tools": ["solana_build", "solana_deploy", "solana_read_state", "solana_verify_tx", "solana_balance", "solana_history"]
      }
    }
  }
}
```

**重启 gateay 生效：**
```bash
openclaw gateway restart
```

**验证连通：**
```bash
curl http://43.156.46.187:3082/health
# → {"status":"ok","tools":18}
```

---

## 第 3 步：优化 agent 的 AGENTS.md

接入 MCP 后，需要在每个 agent 的 `AGENTS.md` 中加入以下规则，确保 agent 不会绕过 MCP 直接用本地 CLI。

在 `AGENTS.md` 末尾追加：

### 通用 agent（所有 team）

```markdown
## MCP 工具使用规则

### Git & 代码管理
- ❌ 禁止使用 exec 执行 git push/pull/clone
- ✅ 所有 git 操作必须通过 git-mcp 的对应 tool：
  - 提交代码：git_pull → git_status → git_push → git_sync
  - 测试服务器：repo_sync(team, host, path)
- ✅ commit message 必须符合 git-operations skill 规范
- ✅ push 前必须跑 repo_check

### 构建
- ❌ 禁止使用 exec 执行 pnpm build / npm build / docker build / gradle / xcodebuild
- ✅ 所有构建必须通过 build-mcp 的对应 tool
- ✅ 构建前必须确认代码已通过 git-mcp 同步

### 代码检查
- ✅ 每次代码改动后主动跑 review_all 或对应的专项检查
- ✅ 报告必须标注 snapshot_sha

### 永远不要
- ❌ 裸用 git push/pull（没有审计、没有检查、代码没增量存储）
- ❌ 裸用构建命令（没有隔离、没有审计）
- ❌ 跳过 repo_check 直接 push
- ❌ 写模糊的 commit message 如 "fix bug" "update"
- ❌ 构建未提交/未同步的代码
```

### Solana 合约开发 agent

额外加：
```markdown
### Solana 合约
- ❌ 禁止使用 exec 运行 cargo build-sbf / solana program deploy
- ✅ 编译：solana_build(projectName, edition)
- ✅ 部署：solana_deploy(soPath, programId, keypairName)
- ✅ 读状态：solana_read_state(programId, seed)
- ✅ 验证交易：solana_verify_tx(signature)
- ✅ 查看余额：solana_balance(address)

### Keypair
- ❌ 禁止在代码或配置中硬编码私钥
- ✅ 使用 solana-mcp 管理的 keypair（通过 keypairName 参数引用）
```

---

## 第 4 步：验证

接入后，验证每一项功能：

```bash
# 测试 git-mcp（从 agent 所在机器）
curl -X POST http://43.156.46.187:3082/tools/git_status \
  -H 'Content-Type: application/json' \
  -d '{"name":"agent"}'
# → 应该返回仓库状态

# 测试 build-mcp
curl -X POST http://43.156.46.187:3081/tools/build_disk \
  -H 'Content-Type: application/json' \
  -d '{}'
# → 应该返回磁盘占用信息

# 测试 solana-mcp
curl -X POST http://43.156.46.187:3080/tools/solana_balance \
  -H 'Content-Type: application/json' \
  -d '{"address":"AqLGnQiHfZv8sj33VdtB3TnhydHXREQ8uNRK7twuwc4L"}'
# → 应该返回余额
```

---

## 按需接入（不是每个 agent 都需要全部）

| Agent 角色 | 需要的 Skills | 需要的 MCP servers |
|------------|-------------|-------------------|
| **通用开发** | git-operations, build-operations, code-review-toolkit | git, build, code-review |
| **Solana 开发** | 通用 + solana-anchor | 通用 + solana-build |
| **代码审计专用** | code-review-toolkit | code-review, git（repo_sync） |
| **运维管理** | git-operations | git |
