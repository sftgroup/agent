# MCP 接入文档

**适用对象：** OpenClaw agent 配置

---

## 服务器信息

```
地址: 43.156.46.187
端口: 3080 (solana-mcp) / 3081 (build-mcp) / 3082 (git-mcp) / 9001 (code-review)
```

---

## OpenClaw 注册配置

在你 OpenClaw gateway 的 `mcp.servers` 中加入（格式：`openclaw mcp set` 或用 JSON）：

```json5
{
  "mcp": {
    "servers": {
      // ─── Solana 合约编译部署 ───
      "solana-build": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3080"
      },

      // ─── 全栈构建服务 ───
      "build": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3081"
      },

      // ─── 代码管理服务 ───
      "git": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:3082"
      },

      // ─── 代码检查服务 ───
      "code-review": {
        "transport": "streamable-http",
        "url": "http://43.156.46.187:9001"
      }
    }
  }
}
```

或通过 CLI 逐个注册：
```bash
openclaw mcp set git           '{"url":"http://43.156.46.187:3082","transport":"streamable-http"}'
openclaw mcp set code-review   '{"url":"http://43.156.46.187:9001","transport":"streamable-http"}'
openclaw mcp set build         '{"url":"http://43.156.46.187:3081","transport":"streamable-http"}'
openclaw mcp set solana-build  '{"url":"http://43.156.46.187:3080","transport":"streamable-http"}'
```

---

## Skills 安装

```bash
cd /tmp && git clone https://github.com/sftgroup/agent.git
cp -r agent/skills/solana-anchor       ~/.openclaw/skills/
cp -r agent/skills/git-operations      ~/.openclaw/skills/
cp -r agent/skills/build-operations    ~/.openclaw/skills/
cp -r agent/skills/code-review-toolkit ~/.openclaw/skills/
```

---

## API 快速测试

```bash
# 健康检查
curl http://43.156.46.187:3080/health  # solana-mcp → {"status":"ok","tools":6}
curl http://43.156.46.187:3081/health  # build-mcp  → {"status":"ok","tools":6}
curl http://43.156.46.187:3082/health  # git-mcp    → {"status":"ok","tools":18}
curl http://43.156.46.187:9001/health   # code-review → {"status":"ok","version":"3.1.0"}

# 查看工具列表
curl http://43.156.46.187:3082/tools | python3 -c "import sys,json; [print(t['name']) for t in json.load(sys.stdin)['tools']]"

# ─── 常用操作示例 ───

# 注册并克隆仓库
curl -X POST http://43.156.46.187:3082/tools/repo_register \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-project","github_url":"https://github.com/sftgroup/my-project.git","default_branch":"master"}'

curl -X POST http://43.156.46.187:3082/tools/git_clone \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-project"}'

# 同步测试服务器代码
curl -X POST http://43.156.46.187:3082/tools/repo_sync \
  -H 'Content-Type: application/json' \
  -d '{"team":"team3","source_host":"43.156.50.6","source_path":"/path/to/project"}'

# 获取快照 SHA
curl -X POST http://43.156.46.187:3082/tools/repo_snapshot \
  -H 'Content-Type: application/json' \
  -d '{"team":"team3"}'

# 构建前端
curl -X POST http://43.156.46.187:3081/tools/build_npm \
  -H 'Content-Type: application/json' \
  -d '{"repoUrl":"https://github.com/sftgroup/web-app.git","buildCmd":"pnpm build"}'

# 编译合约
curl -X POST http://43.156.46.187:3080/tools/solana_build \
  -H 'Content-Type: application/json' \
  -d '{"projectName":"contra-ai","edition":"2021"}'

# 代码全量审查
curl -X POST http://43.156.46.187:9001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"review_all","arguments":{"project_path":"/opt/mcp/repos/my-project","language":"js-ts"}},"id":1}'
```

---

## 工具速查

### solana-mcp (6 tools)

| Tool | 干什么 |
|------|--------|
| `solana_build` | 编译 SBF .so |
| `solana_deploy` | 部署/升级合约 |
| `solana_read_state` | 读链上 PDA 状态 |
| `solana_verify_tx` | 确认交易 |
| `solana_balance` | SOL/SPL 余额 |
| `solana_history` | 操作日志 |

### build-mcp (6 tools)

| Tool | 干什么 |
|------|--------|
| `build_npm` | 前端/Node 构建 |
| `build_docker` | Docker 构建推送 |
| `build_mobile` | 移动端（Flutter/React Native/Expo） |
| `build_status` | 构建历史 |
| `build_clean` | 清理旧产物 |
| `build_disk` | 磁盘占用 |

### git-mcp (18 tools)

| 场景 | 工具流程 |
|------|----------|
| **日常 push** | `git_pull` → `git_status` → `repo_check` → `git_push` → `git_sync` |
| **代码审查** | `repo_sync` → `repo_snapshot` → 传 SHA 给 code-review |
| **版本发布** | `git_sync(tag)` `git_create_tag` `git_tags` |
| **查找审计** | `repo_list` `repo_info` `git_log` `git_audit` `git_sync_status` |

### code-review (6 tools)

| Tool | 干什么 |
|------|--------|
| `review_all` | 全量检查（lint + format + type + complexity + deps） |
| `review_lint` | 代码规范检查 |
| `review_format` | 格式检查 |
| `review_types` | 类型检查 |
| `review_complexity` | 圈复杂度 |
| `review_deps` | 依赖安全检查 |

> **注意**：code-review 只读 `/opt/mcp/repos/` 下的代码，需要先通过 git-mcp 的 `repo_sync` 或 `git_clone` 把代码同步到这个路径下。
