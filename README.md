# SFT Group — Agent 工具箱

这个仓库是 stevenwang 的 OpenClaw 多实例集群的**共享技能库**和**远程工具服务**。

## 一句话说明

> 7 台 OpenClaw 实例共用一个代码中心。Skill 告诉 agent 怎么做，MCP 提供远程工具让 agent 调用。代码写在本机，提交到中心服务器，代码检查、构建、部署都在中心服务器上完成。

---

## 目录

- [这个仓库有什么](#这个仓库有什么)
- [谁在用](#谁在用)
- [怎么用](#怎么用)
  - [1. 安装 Skill（每个实例只需一次）](#1-安装-skill每个实例只需一次)
  - [2. 注册 MCP 工具（每个实例只需一次）](#2-注册-mcp-工具每个实例只需一次)
  - [3. 日常使用](#3-日常使用)
- [核心流程](#核心流程)
- [技能速查](#技能速查)
- [远程工具速查](#远程工具速查)

---

## 这个仓库有什么

```
sftgroup/agent/
├── skills/                    ← 告诉 agent 怎么做（知识 + 脚本 + 规范）
│   ├── code-review-toolkit/   ← 代码机械检查（lint/格式/类型/复杂度/依赖漏洞）
│   ├── git-operations/        ← Git 工作流规范（怎么写 commit、怎么同步）
│   ├── build-operations/      ← 构建服务规范（构建前必须先同步代码）
│   └── solana-anchor/         ← Solana 合约开发指南
│
└── （MCP 服务器代码）          ← 部署在中心服务器上，agent 远程调用
    ├── 代码管理（push/pull/同步）
    ├── 代码检查（15 种 lint 工具，一次全跑）
    ├── 项目构建（前端/合约/移动端）
    └── 链上操作（Solana 部署/读状态/验证）
```

---

## 谁在用

| 实例 | 地址 | 缓存优化 | 用到的 Skill | 用到的 MCP |
|------|------|:--------:|--------------|------------|
| team1 | 43.156.138.166 | — | — | — |
| team2 | 43.156.55.212 | ✅ | — | — |
| **team3** | **43.156.50.6** | ✅ **7/7** | code-review-toolkit | code-review / git / build |
| team4 | 43.159.60.46 | ✅ | — | — |
| team5 | 124.156.203.132 | — | — | — |
| team6 | 129.226.203.60 | ✅ | — | — |

---

## 怎么用

### 1. 安装 Skill（每个实例只需一次）

```bash
# 拉取仓库
cd /tmp && git clone git@github.com:sftgroup/agent.git

# 把需要的 skill 复制到 OpenClaw skill 目录
cp -r agent/skills/code-review-toolkit ~/.openclaw/skills/
cp -r agent/skills/git-operations ~/.openclaw/skills/
cp -r agent/skills/build-operations ~/.openclaw/skills/
cp -r agent/skills/solana-anchor ~/.openclaw/skills/
```

### 2. 注册 MCP 工具（每个实例只需一次）

编辑 `~/.openclaw/openclaw.json`，在 `tools.mcpServers` 中加入：

```json5
{
  "tools": {
    "mcpServers": {
      // 代码管理（push/pull/sync/审计）
      "git": {
        "type": "http",
        "url": "http://43.156.46.187:3082",
        "tools": ["repo_register", "repo_list", "repo_info", "git_create_repo",
                  "git_clone", "git_pull", "git_push", "git_sync", "git_sync_status",
                  "git_status", "git_tags", "git_create_tag", "git_log", "git_audit",
                  "git_checkout", "repo_check", "repo_sync", "repo_snapshot"]
      },
      // 代码检查（15 种 lint 工具）
      "code-review": {
        "type": "http",
        "url": "http://43.156.46.187:9001",
        "tools": ["review_all", "review_lint", "review_format", "review_types", "review_complexity", "review_deps"]
      },
      // 项目构建
      "build": {
        "type": "http",
        "url": "http://43.156.46.187:3081",
        "tools": ["build_npm", "build_docker", "build_mobile", "build_status", "build_clean", "build_disk"]
      },
      // Solana 合约
      "solana-build": {
        "type": "http",
        "url": "http://43.156.46.187:3080",
        "tools": ["solana_build", "solana_deploy", "solana_read_state", "solana_verify_tx", "solana_balance", "solana_history"]
      }
    }
  }
}
```

> 详细接入文档见 [docs/connect.md](docs/connect.md)，部署运维见 [docs/deploy.md](docs/deploy.md)。

### 3. 日常使用

Agent 会自动按 SKILL.md 里的规范调用 MCP 工具。**开发者不需要手动操作**。流程是：

```
写代码 → 同步到中心服务器 → 自动跑代码检查 → 发现格式/类型/依赖问题
    → 修正 → 重新同步 → 确认通过 → 推送到 GitHub
```

---

## 核心流程

```
                   你写代码 (team1~team6)
                        │
                        ▼
              git-mcp 同步到中心服务器
              保存到 /opt/mcp/repos/<team>/
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    code-review      build-mcp     solana-mcp
    机械检查(0秒)     构建项目       链上部署
    - 格式对了吗?    - npm build    - 合约编译
    - 类型对了吗?    - docker build - 部署到链
    - 依赖有漏洞?    - 移动端打包   - 验证交易
    - 代码写太长了?
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
              git-mcp 推送到 GitHub
```

---

## 技能速查

### 🔍 code-review-toolkit — 代码检查

**作用**：机器自动检查代码，不需要人来看。检查格式、类型、复杂度、依赖漏洞。

| 能检查什么 | 用什么工具 |
|------------|------------|
| Solidity 合约 | solhint（格式规范）+ forge fmt（代码格式） |
| TypeScript/JS | eslint（规范）+ prettier（格式）+ tsc（类型） |
| Python | ruff（规范）+ black（格式）+ mypy（类型） |
| Shell 脚本 | shellcheck（规范）+ shfmt（格式） |

**在哪**：MCP 服务器 `43.156.46.187:9001`

**接入文档**：`skills/code-review-toolkit/references/apply-guide.md`

### 🔀 git-operations — Git 规范

**作用**：规定 commit message 怎么写、push 前要检查什么。

**三个铁律**：
1. commit 必须写清楚改了啥、为什么改、改了哪里
2. push 前必须先跑代码检查
3. 代码先存到中心服务器，确认无误再推到 GitHub

### 📦 build-operations — 构建规范

**作用**：规定构建前必须做什么。

**铁律**：构建前必须先同步代码（git pull → git push → git sync），不允许对未同步的代码进行构建。

---

## 远程工具速查

### 中心服务器：43.156.46.187

| 端口 | 服务 | 做什么 | 依赖 |
|:----:|------|--------|------|
| 9001 | code-review | 代码机械检查（15 种工具） | git-mcp `repo_sync` → `/opt/mcp/repos/<team>/` |
| **3082** | **git-mcp** | **代码管理（push/pull/sync/审计）** | 无 |
| **3081** | **build-mcp** | **项目构建（npm/docker/mobile）** | git-mcp + code-review |
| **3080** | **solana-mcp** | **Solana 合约（编译/部署/读链）** | Solana CLI |

> 全部 4 个 MCP 服务已部署并运行。`repoBasePath` 已配置为 `/opt/mcp/repos`，与 code-review 路径一致。

### 如何验证连通

```bash
# 检查代码审查服务是否在线
curl http://43.156.46.187:9001/health
# → {"status":"ok","version":"3.1.0","mode":"local"}
```

---

## 常见问题

### Q: 这个仓库和我本机上的代码是什么关系？
本机代码通过 git-mcp 的 `repo_sync` 同步到中心服务器上的 `/opt/mcp/repos/<team>/`。code-review 读取这个目录做检查。git-mcp 的 `repoBasePath` 必须和 code-review 的 `REPOS_ROOT` 指向同一个目录。

### Q: 需要我在每台机器上装 lint 工具吗？
**不需要。** 所有 lint 工具（eslint/solhint/ruff 等 15 种）都装在中心服务器上，你只需要在 OpenClaw 里注册 MCP 就行了。

### Q: 换了 MCP 服务器怎么办？
运行 `skills/code-review-toolkit/scripts/install-linters.sh` 在新服务器上一键安装全部工具，然后修改 OpenClaw 配置里的 IP 地址。

### Q: 为什么有些实例没接入？
team2/4/6 已经完成了缓存优化，但 Skill 和 MCP 还没注册。按本文档的"怎么用"一节操作即可。

### Q: 我能不能直接用 curl 调 MCP？
可以，但不建议。正常流程应该是 OpenClaw agent 自动调用。如果非要手动测试，参考 `skills/code-review-toolkit/references/integration-spec.md` 里的 JSON-RPC 调用示例。

---

## 维护者

- **stevenwang** — 实例运维 + MCP 服务器管理
- **team3 (OpenClaw architect agent)** — Skill 开发 + 文档维护

## 更新日志

| 日期 | 更新 |
|------|------|
| 07-10 | code-review-toolkit v3.1：15 种工具全装，统一返回值，Shell 检查，路径白名单 |
| 07-10 | instance-doctor v2.0：缓存命中链优化，4 台实例已验证 |
| 07-09 | code-review-toolkit 初始版 + instance-doctor 初始版 |
