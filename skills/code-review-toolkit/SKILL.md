---
name: code-review-toolkit
description: "Code quality MCP v3.0 — centralized lint/format/types/complexity/deps audit. Local filesystem on MCP server, serves all OpenClaw instances."
---

# Code Review Toolkit v3.0

Centralized code quality review via MCP. Code lives on MCP server (git-managed by code-mgmt MCP). Review runs locally. No SSH, no per-machine install.

## Architecture

```
teamN ──MCP tool call──→ 43.156.46.187:9001 (code-review-mcp)
                              │
                              ├─ /opt/mcp/repos/<team>/  ← synced by code-mgmt MCP
                              │
                              ├─ solhint / eslint / ruff   ← lint
                              ├─ forge fmt / prettier / black  ← format
                              ├─ tsc / mypy                ← types
                              ├─ radon / eslint-complexity  ← complexity
                              └─ npm audit / pip-audit      ← deps
```

## Tool Matrix

| Layer | Solidity | JS/TS | Python |
|-------|----------|-------|--------|
| Lint | solhint | ESLint | Ruff |
| Format | forge fmt | Prettier | Black |
| Types | — | tsc --noEmit | mypy |
| Complexity | — | eslint rules | radon |
| Deps | — | npm audit | pip-audit |

## MCP Tools

| Tool | Params | Description |
|------|--------|-------------|
| `review_lint` | project_path, language | Lint checks per language |
| `review_format` | project_path, language | Format check (dry-run) |
| `review_types` | project_path, language | Type check (tsc/mypy) |
| `review_complexity` | project_path | Cyclomatic complexity |
| `review_deps` | project_path | npm audit + pip-audit |
| `review_all` | project_path, language | Full suite (all 5 layers) |

Severity: P0 (must fix, type errors) / P1 (should fix, lint/format) / P2 (nice to have, complexity)

## Deployment

| Item | Value |
|------|-------|
| Server | 43.156.46.187 |
| Port | 9001 |
| systemd | code-review-mcp.service |
| Dir | /opt/mcp/code-review/ |
| Python | 3.12 (stdlib only, zero deps) |
| Health | `curl http://43.156.46.187:9001/health` → `{"status":"ok","version":"3.0.0","mode":"local"}` |

## Register on OpenClaw

```json
{
  "mcp": {
    "servers": {
      "code-review": {
        "command": "http",
        "args": ["http://43.156.46.187:9001/mcp"],
        "transport": "streamable-http"
      }
    }
  }
}
```

## Integration (接口规范)

code-review MCP 独立于代码管理 MCP。接入只需：

1. 代码管理 MCP 把项目同步到 `/opt/mcp/repos/<team>/`
2. 调 `review_all(project_path="/opt/mcp/repos/<team>", language="all")` 即可

没有额外 API key、token、webhook。纯本地文件系统读取 + 子进程调用。

完整接口规范 → `references/integration-spec.md`（包含：上游依赖、目录约定、调用示例、错误处理、接入 checklist、边界划分）。

## Files

| Path | Purpose |
|------|---------|
| `server.py` | MCP HTTP server v3.0 (single-file, no deps) |
| `references/integration-spec.md` | 接口规范（上游依赖、调用示例、错误处理、接入 checklist） |
| `references/.eslintrc.json` | JS/TS lint baseline |
| `references/.solhint.json` | Solidity lint baseline |
| `references/report-template.md` | Review report template |
| `scripts/` | Standalone CLI scripts (offline fallback) |
