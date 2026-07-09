---
name: code-review-toolkit
description: "Code quality MCP — centralized lint, format, types, complexity, deps audit. One server serves all OpenClaw instances."
---

# Code Review Toolkit

Centralized code quality review via MCP. One server with all linters → all OpenClaw instances call via tool. No per-machine install.

## Architecture

```
                     tool call (HTTP)
team1 ─┐                 │
team2 ─┤  http://<host>:9020/mcp
team3 ─┼────────────────────→  code-review-mcp
team4 ─┤  review_lint           ├─ ESLint / Solhint / Ruff
team5 ─┤  review_format         ├─ Prettier / forge fmt / Black
team6 ─┤  review_types          ├─ tsc / mypy
team7 ─┘  review_complexity     ├─ radon / eslint
          review_deps           └─ npm audit / pip-audit
          review_all
```

## Tool Matrix

| Layer | JS/TS | Solidity | Python |
|-------|-------|----------|--------|
| Lint | ESLint | Solhint | Ruff |
| Format | Prettier | forge fmt | Black |
| Types | tsc --noEmit | — | mypy |
| Complexity | eslint rules | — | radon |
| Deps | npm audit | — | pip-audit |

## MCP Tools

| Tool | Params | Description |
|------|--------|-------------|
| `review_lint` | language, project_path | Lint checks per language |
| `review_format` | language, project_path | Format check (dry-run) |
| `review_types` | language, project_path | Type check (tsc/mypy) |
| `review_complexity` | project_path | Cyclomatic complexity |
| `review_deps` | project_path | npm audit + pip-audit |
| `review_all` | language, project_path | Full suite |

Severity: P0 (must fix, type errors) / P1 (should fix, lint) / P2 (nice to have, complexity)

## Deploy

```bash
# On the central server
cd skills/code-review-toolkit
bash deploy.sh

# Verify
curl http://localhost:9020/health
```

## Register on each OpenClaw instance

```bash
openclaw mcp add code-review \
  --url http://<central-server>:9020/mcp \
  --transport streamable-http \
  --timeout 30 --connect-timeout 5

# Verify
openclaw mcp doctor code-review --probe
```

## Files

| Path | Purpose |
|------|---------|
| `server.py` | MCP HTTP server (single-file, no deps) |
| `deploy.sh` | Install linters + start server |
| `code-review-mcp.service` | systemd unit (optional) |
| `configs/.solhint.json` | Solidity lint baseline |
| `configs/.eslintrc.json` | JS/TS lint baseline |
| `scripts/` | Standalone CLI scripts (fallback, no MCP needed) |
| `references/` | Report template, config docs |
