---
name: code-review-toolkit
description: "Code quality MCP v4.0 — centralized lint/format/types/complexity/deps audit. Local filesystem on MCP server, serves all OpenClaw instances. Integrates with git-mcp for code sync + SHA traceability."
---

# Code Review Toolkit v4.0

Code Review MCP 只做一件事：**代码机械审查**。调用方是 QA 子代理（先跑机械检查 → 再跑 AI review）。代码由 git-mcp (MCP server `git`) 的 `repo_sync` 同步，构建和发布不在本 Skill 范围内。

## Architecture

```
git-mcp: repo_sync("team3", "43.156.50.6", "/path")
          │
          ▼
  /opt/mcp/repos/team3/          ← 代码副本（中心服务器本地）
          │
          ▼
code-review-mcp: review_all("/opt/mcp/repos/team3", "all")
          │
          ├─ solhint / eslint / ruff      ← lint
          ├─ forge fmt / prettier / black  ← format
          ├─ tsc / mypy                    ← types
          ├─ radon / eslint-complexity     ← complexity
          └─ npm audit / pip-audit         ← deps
```

## 上下游依赖

| 方向 | 服务 | 提供什么 |
|------|------|----------|
| **上游** | git-mcp | `repo_sync` 同步代码到 `/opt/mcp/repos/<team>/`、`repo_snapshot` 提供 SHA |
| **下游** | QA 子代理 | 拿到 review 报告 → AI review 逻辑、边界、UX |

code-review **不负责**：构建（build-mcp 的事）、发布（git-sync 的事）、安全检查（security 子代理的事）。

## 版本锁定

所有工具版本固定，防止自动升级导致行为不一致。升级需同时更新此表 + `scripts/install-linters.sh`。

| Tool | Version | Installed via |
|------|---------|---------------|
| eslint | 10.6.0 | npm |
| prettier | 3.9.5 | npm |
| typescript (tsc) | 7.0.2 | npm |
| solhint | 6.2.3 | npm |
| ruff | 0.15.20 | pip |
| black | 26.5.1 | pip |
| mypy | 2.2.0 | pip |
| radon | 6.0.1 | pip |
| pip-audit | 2.10.1 | pip |
| shellcheck | 0.9.0 | apt |
| shfmt | 3.12.0 | snap |
| forge | 1.7.1 | foundryup (stable) |
| node | 22.x | nodesource |
| python | 3.12.x | system |

## Tool Matrix

| Layer | Solidity | JS/TS | Python | Shell |
|-------|----------|-------|--------|-------|
| Lint | solhint 6.2.3 | ESLint 10.6.0 | Ruff 0.15.20 | shellcheck |
| Format | forge fmt 1.7.1 | Prettier 3.9.5 | Black 26.5.1 | shfmt 3.12.0 |
| Types | — | tsc 7.0.2 | mypy 2.2.0 | — |
| Complexity | — | eslint rules | radon 6.0.1 | — |
| Deps | — | npm audit | pip-audit 2.10.1 | — |

## MCP Tools

| Tool | Params | Description |
|------|--------|-------------|
| `review_lint` | `project_path`, `language` | Lint checks per language |
| `review_format` | `project_path`, `language` | Format check (dry-run) |
| `review_types` | `project_path`, `language` | Type check (tsc/mypy) |
| `review_complexity` | `project_path` | Cyclomatic complexity |
| `review_deps` | `project_path` | npm audit + pip-audit |
| `review_all` | `project_path`, `language` | Full suite (all 5 layers) |

`language` 枚举：`solidity` | `js-ts` | `python` | `shell` | `all`

返回值统一格式：`{ status, project, language, summary, results }`

## 与 git-mcp 协作

git-mcp 管理代码、code-review 审查代码。两者的接口：

| git-mcp 调用 | 返回 | code-review 调用 |
|-------------|------|-----------------|
| `repo_sync(team="team3", source_host="43.156.50.6", source_path="...")` | `{ sha: "abc123", status: "synced" }` | `review_all(project_path="/opt/mcp/repos/team3", language="all")` |
| `repo_snapshot(team="team3")` | `{ sha: "abc123" }` | 用于报告回溯 |

`project_path` 映射规则：`/opt/mcp/repos/` + `team名称`（如 `team3` → `/opt/mcp/repos/team3`）。

## 完整调用流程

```
1. git-mcp.repo_sync(team="team3", source_host="43.156.50.6", source_path="/home/ubuntu/.openclaw/workspace/team3")
   → 返回 sha: "abc123"

2. code-review-mcp.review_all(project_path="/opt/mcp/repos/team3", language="all")
   → 返回机械检查结果，报告标注 reviewed_sha: "abc123"

3. 修复 P0/P1 问题

4. git-mcp.repo_sync → 重新 sync，新的 sha

5. code-review-mcp.review_all → 确认清零

6. QA 子代理据此做 AI review
```

## Deployment

| Item | Value |
|------|-------|
| Server | 43.156.46.187 |
| Port | 9001 |
| systemd | code-review-mcp.service |
| Dir | /opt/mcp/code-review/ |
| Python | 3.12 (stdlib only, zero deps) |
| Health | `curl http://43.156.46.187:9001/health` → `{"status":"ok","version":"4.0.0","mode":"local"}` |

## Register on OpenClaw

```bash
openclaw mcp add code-review \
  --url http://43.156.46.187:9001 \
  --transport streamable-http \
  --timeout 60
```

⚠️ 用 `http://43.156.46.187:9001`（根路径），不用 `/mcp`。

## Files

| Path | Purpose |
|------|---------|
| `server.py` | MCP HTTP server v4.0 (single-file, no deps) |
| `references/integration-spec.md` | 接口规范（上游依赖、调用示例、错误处理、接入 checklist） |
| `references/apply-guide.md` | Apply 指南（其他 Agent 如何接入：4 步 + 工作流模板 + 排错） |
| `references/.eslintrc.json` | JS/TS lint baseline |
| `references/.solhint.json` | Solidity lint baseline |
| `references/report-template.md` | Review report template |
| `scripts/` | Standalone CLI scripts (offline fallback) |
