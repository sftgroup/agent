# MCP 接入文档

**适用对象：** OpenClaw agent 配置

---

## 服务器信息

```
地址: 43.156.46.187
端口: 3080 (solana-mcp) / 3081 (build-mcp) / 3082 (git-mcp)
```

---

## OpenClaw 注册配置

在你 OpenClaw gateway 的 `tools.mcpServers` 中加入：

```json5
{
  "tools": {
    "mcpServers": {
      // ─── Solana 合约编译部署 ───
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
      },

      // ─── 全栈构建服务 ───
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

      // ─── 代码管理服务 ───
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
      }
    }
  }
}
```

---

## Skills 安装

```bash
openclaw skills install git:sftgroup/agent@master#skills/solana-anchor --as solana-anchor
openclaw skills install git:sftgroup/agent@master#skills/git-operations --as git-operations
openclaw skills install git:sftgroup/agent@master#skills/build-operations --as build-operations
```

---

## API 快速测试

```bash
# 健康检查
curl http://43.156.46.187:3080/health  # solana-mcp
curl http://43.156.46.187:3081/health  # build-mcp
curl http://43.156.46.187:3082/health  # git-mcp

# 查看所有工具
curl http://43.156.46.187:3080/tools
curl http://43.156.46.187:3081/tools
curl http://43.156.46.187:3082/tools

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
| `build_mobile` | 移动端构建 |
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
