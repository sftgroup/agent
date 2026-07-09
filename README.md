# Agent Skills & MCP Services

SFT Group 的 OpenClaw agent 技能库和远程工具服务。

---

## 仓库结构

```
sftgroup/agent/
├── README.md
│
├── skills/                          # Skill 知识库
│   ├── solana-anchor/               # Solana 合约开发
│   ├── git-operations/              # Git 工作流规范
│   ├── build-operations/            # 构建服务规范
│   └── code-review-toolkit/         # 代码审计 (已有)
│
└── mcp/                             # MCP 远程工具服务
    ├── solana-mcp/   (6 tools)      # Solana 合约编译部署
    ├── build-mcp/    (6 tools)      # 全栈构建服务
    └── git-mcp/      (18 tools)     # 代码管理 + 版本控制
```

---

## Skills 安装

```bash
# 安装单个 skill
openclaw skills install git:sftgroup/agent@master#skills/solana-anchor --as solana-anchor
openclaw skills install git:sftgroup/agent@master#skills/git-operations --as git-operations
openclaw skills install git:sftgroup/agent@master#skills/build-operations --as build-operations
openclaw skills install git:sftgroup/agent@master#skills/code-review-toolkit --as code-review-toolkit
```

---

## 能力总览

### 🏗️ solana-anchor — Solana 合约开发

| 层 | 内容 |
|----|------|
| **Skill** | SBF 兼容性 / PDA / Timelock / SPL Token / Anchor / Bug 库 |
| **Scripts** | 编译部署 / 安装工具链 / 读链上状态 |
| **Templates** | Anchor 合约骨架 (Rust) / 客户端 (TypeScript) |
| **MCP tools** | `solana_build` `solana_deploy` `solana_read_state` `solana_verify_tx` `solana_balance` `solana_history` |

### 🔀 git-mcp — 代码管理

**设计：增量存储，永不覆盖。GitHub 推送是单独的有意识操作。**

| 场景 | Tools |
|------|-------|
| **仓库管理** | `repo_register` `repo_list` `repo_info` `git_create_repo` |
| **日常 push** | `git_pull` → `git_status` → `repo_check` → `git_push` → `git_sync` |
| **版本发布** | `git_sync(tag)` `git_create_tag` `git_tags` |
| **测试同步** | `repo_sync` (rsync 从测试服务器拉代码) `repo_snapshot` (SHA 溯源) |
| **查找审计** | `git_log` `git_audit` `git_checkout` `git_sync_status` |

**Skill (git-operations) 强制规则：**
- commit message 必须写清改了什么 / 为什么 / 改了哪里
- push 前必须跑 `repo_check`
- `git_sync` 前代码只存在 MCP 本地，不会意外覆盖 GitHub

### 📦 build-mcp — 全栈构建

| Tool | 说明 |
|------|------|
| `build_npm` | 前端/Node (Vue/React/Next/Nuxt)，monorepo 支持 |
| `build_docker` | Docker 构建 + 推送，多 registry |
| `build_mobile` | React Native / Flutter / Expo |
| `build_status` | 构建历史 + 状态查询 |
| `build_clean` | 按时间/Build ID 清理旧产物 |
| `build_disk` | 构建工作区磁盘占用 |

**Skill (build-operations) 强制规则：**
- 构建前必须先 git_pull → git_push → git_sync（通过 git-mcp）
- 不构建未提交/未同步的代码
- 构建在隔离目录 `/tmp/build-mcp/<type>-<id>/` 执行，互不干扰

### 🔍 code-review-toolkit — 代码机械审计（已有）

已部署在 `43.156.46.187:9001`。依赖 git-mcp 的 `repo_sync` 提供代码 + `repo_snapshot` 提供 SHA 溯源。

| Tool | 说明 |
|------|------|
| `review_lint` | eslint / solhint / ruff |
| `review_format` | prettier / forge fmt / black |
| `review_types` | tsc / mypy |
| `review_complexity` | 圈复杂度 |
| `review_deps` | npm audit / pip-audit |
| `review_all` | 全量审查 |

**与 git-mcp 协作：**
```
repo_sync("team3", "43.156.50.6", "/path") → sha: abc123
review_all("/opt/mcp/repos/team3", "all")   → 报告标注 snapshot_sha: abc123
```

---

## MCP 服务注册 (OpenClaw 配置)

```json5
{
  "tools": {
    "mcpServers": {
      "solana-build": {
        "type": "http",
        "url": "http://<服务器>:3080",
        "tools": ["solana_build", "solana_deploy", "solana_read_state", "solana_verify_tx", "solana_balance", "solana_history"]
      },
      "build": {
        "type": "http",
        "url": "http://<服务器>:3081",
        "tools": ["build_npm", "build_docker", "build_mobile", "build_status", "build_clean", "build_disk"]
      },
      "git": {
        "type": "http",
        "url": "http://<服务器>:3082",
        "tools": ["repo_register", "repo_list", "repo_info", "git_create_repo",
                   "git_clone", "git_pull", "git_push", "git_sync", "git_sync_status",
                   "git_status", "git_tags", "git_create_tag", "git_log", "git_audit",
                   "git_checkout", "repo_check",
                   "repo_sync", "repo_snapshot"]
      }
    }
  }
}
```

---

## 安全说明

- **GitHub Token**: 只在 git-mcp 服务器上通过 `GIT_TOKEN` 环境变量配置，agent 完全无感知
- **Solana Keypair**: solana-mcp 部署时使用临时文件 (chmod 600)，用完立即删除
- **网络**: 所有 MCP 绑定 127.0.0.1，生产环境通过 Nginx 反代 + IP 白名单暴露
- **构建隔离**: build-mcp 在 `/tmp/build-mcp/` 下隔离执行
- **代码增量**: git-mcp 所有 commits 存储在本地，永不覆盖，提供完整审计日志
- **SHA 溯源**: code-review / QA / 安全审计报告必须标注 `snapshot_sha`
