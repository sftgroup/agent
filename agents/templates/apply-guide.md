# MCP 接入指南 — 从零到跑通

> 将 OpenClaw agent 接入中心 MCP 服务器（`43.156.46.187`）的完整步骤。
> 走完这三步，你的 agent 就能用 MCP，不再裸用 shell 命令。

---

## 前置条件

- 服务器 `43.156.46.187` 端口 3080-3082, 9001 已开放
- 你有 OpenClaw gateway 的管理权限（能改 `openclaw.json`）

---

## 第 1 步：安装 Skills（5 分钟）

Skills 告诉 agent **什么场景该怎么做**。把它们装到 OpenClaw skills 目录：

```bash
cd /tmp && git clone https://github.com/sftgroup/agent.git
cp -r agent/skills/git-operations      ~/.openclaw/skills/
cp -r agent/skills/build-operations    ~/.openclaw/skills/
cp -r agent/skills/code-review-toolkit ~/.openclaw/skills/
cp -r agent/skills/solana-anchor       ~/.openclaw/skills/
```

验证：
```bash
ls ~/.openclaw/skills/
# → build-operations  code-review-toolkit  git-operations  solana-anchor
```

> **按需安装**：不是每个 agent 都需要全部 4 个。看你 agent 的角色，对照下面的表格选择性安装。

---

## 第 2 步：注册 MCP Servers（5 分钟）

编辑 `~/.openclaw/openclaw.json`（或 gateway 的 config.yaml），在 `tools.mcpServers` 中加入：

```json5
{
  "tools": {
    "mcpServers": {
      // ─── 代码管理（所有 agent 必备）───
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

      // ─── 代码检查（有代码变更的 agent 必备）───
      "code-review": {
        "type": "http",
        "url": "http://43.156.46.187:9001",
        "tools": [
          "review_all",
          "review_lint",
          "review_format",
          "review_types",
          "review_complexity",
          "review_deps"
        ]
      },

      // ─── 构建（有构建需求的 agent）───
      "build": {
        "type": "http",
        "url": "http://43.156.46.187:3081",
        "tools": [
          "build_npm",
          "build_docker",
          "build_mobile",
          "build_status",
          "build_clean",
          "build_disk"
        ]
      },

      // ─── Solana 合约（Solana agent 专用）───
      "solana-build": {
        "type": "http",
        "url": "http://43.156.46.187:3080",
        "tools": [
          "solana_build",
          "solana_deploy",
          "solana_read_state",
          "solana_verify_tx",
          "solana_balance",
          "solana_history"
        ]
      }
    }
  }
}
```

**重启 gateway 使配置生效：**
```bash
openclaw gateway restart
```

> ⚠️ 如果你使用 `config.yaml`（多实例部署），格式略有不同。参考 `docs/connect.md`。

**验证连通性：**
```bash
curl http://43.156.46.187:3082/health  # → {"status":"ok","tools":18}
curl http://43.156.46.187:9001/health   # → {"status":"ok","version":"3.1.0"}
curl http://43.156.46.187:3081/health  # → {"status":"ok","tools":6}
curl http://43.156.46.187:3080/health  # → {"status":"ok","tools":6}
```

---

## 第 3 步：给 AGENTS.md 追加 MCP 规则（3 分钟）

打开你的 agent 的 `AGENTS.md`，把 [agents-template.md](agents-template.md) 的内容复制到末尾。

**如果你不确定要保留哪些规则，按角色裁剪：**

| 你的 Agent 角色 | 需要安装的 Skills | 需要注册的 MCP | AGENTS.md 保留哪些规则 |
|----------------|------------------|---------------|----------------------|
| **Solana 合约开发** | 全部 4 个 | 全部 4 个 | 全部规则 |
| **前端/后端开发** | git-operations, build-operations, code-review-toolkit | git, build, code-review | 删掉「Solana 合约规则」 |
| **代码审计专用** | git-operations, code-review-toolkit | git, code-review | 只保留「Git」「代码检查」 |
| **构建/部署专用** | git-operations, build-operations | git, build | 保留「Git」「构建」 |
| **项目管理/运维** | git-operations | git | 只保留「Git & 代码管理」 |

---

## 第 4 步：验证 agent 真的在用 MCP

接入后，跟你的 agent 说一句：

> 帮我看看 team 仓库的状态

正确的响应应该是 agent 调用 `git_status(team)`，**不是** 执行 `cd xxx && git status`。

**查日志确认：**
```bash
# 看 agent 最后一次的 tool call
journalctl -u openclaw --since "5 min ago" | grep -E "tool_call|git_status|build_npm|review_all" | tail -5
```

---

## 按角色配置矩阵

```
                     git    code-review    build    solana-build    安装的 skills
                     ───    ───────────    ─────    ────────────    ────────────
Solana 开发          ✅     ✅            ✅       ✅            全部 4 个
前端/后端            ✅     ✅            ✅       ❌            git + build + review
代码审计             ✅     ✅            ❌       ❌            git + review
构建/部署            ✅     ❌            ✅       ❌            git + build
运维                 ✅     ❌            ❌       ❌            git
```

---

## 故障排查

### tool 调用失败 / timeout
```bash
# 1. 检查服务是否存活
curl http://43.156.46.187:3082/health

# 2. 检查 openclaw.json 语法
python3 -c "import json; json.load(open('$HOME/.openclaw/openclaw.json'))" && echo "OK"

# 3. 看 gateway 日志
journalctl -u openclaw -f --since "1 min ago"

# 4. 重启 gateway
openclaw gateway restart
```

### 安全组阻断
如果 curl 不通，去腾讯云控制台检查安全组入站规则，开放 3080-3082, 9001 端口。

### 工具已注册但 agent 不用
说明 AGENTS.md 没生效。确认：
1. 规则追加到了正确的 agent 的 AGENTS.md（不是模板文件）
2. 重启了 gateway
3. agent 没有旧的「允许 exec」规则覆盖新规则
