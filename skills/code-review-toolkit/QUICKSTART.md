# Code Review MCP — Quickstart

让 OpenClaw agent 通过 MCP 协议远程执行代码审查（lint/format/types/complexity/deps），**5 步搞定**。

## 前置条件

- OpenClaw Gateway 已运行
- 能访问 MCP 服务器 43.156.46.187（端口 9001）

---

## Step 1: 装 Skill

```bash
git clone https://github.com/sftgroup/agent.git /tmp/agent-skills
openclaw skills install /tmp/agent-skills/skills/code-review-toolkit
```

验证：

```bash
openclaw skills list | grep code-review-toolkit
# 应显示 ✓ ready
```

---

## Step 2: 注册 MCP

```bash
openclaw mcp add code-review \
  --url http://43.156.46.187:9001 \
  --transport streamable-http \
  --timeout 60
```

⚠️ 用 `http://43.156.46.187:9001`（根路径），不用 `/mcp`。

---

## Step 3: 重启 Gateway

```bash
openclaw gateway restart
```

⚠️ 必须重启，否则 tool 列表为空。

验证：

```bash
openclaw mcp probe | grep code-review
# 应看到 code-review: 7 tools
```

---

## Step 4: 更新 AGENTS.md

在主 agent 的 AGENTS.md 加入以下规则：

```markdown
## MCP 工具使用规则

| MCP Server | 端口 | Transport | Tools | 用途 |
|------------|:--:|-----------|:--:|------|
| code-review | 9001 | streamable-http | 7 | lint/format/types/complexity/deps |

### ⚠️ 强制使用

| 你的工作 | 必须使用 | 工具名模式 |
|---------|---------|-----------|
| 代码审查(lint/format/type) | code-review-mcp | `code-review__*` (7 tools) |

> 🔴 代码审查**严禁**通过 exec 执行 shell（如 `exec eslint`、`exec prettier`），必须走 MCP。

禁止行为：
| ❌ 禁止 | ✅ 替代 |
|---------|---------|
| exec eslint/ruff/solhint | `code-review__review_lint()` |
| exec prettier/forge-fmt/black | `code-review__review_format()` |
| exec tsc/mypy | `code-review__review_types()` |
| exec radon | `code-review__review_complexity()` |
| exec npm-audit/pip-audit | `code-review__review_deps()` |
```

### QA 子 agent 专属规则

QA 的 AGENTS.md 加二段式审查流程：

```markdown
## 审查流程

Step 0: MCP 机械检查
  code-review__report(project_path="/opt/mcp/repos/<team>", language="all")
  → score/100, status(pass/warn/fail), P0/P1

Step 1: 分层决策
  fail → 标注 P0 → 修 → 重跑
  warn → 看 breakdown → drill-down 对应 tool
  pass → L1→L2→L3 人工审查

Step 2: 写报告 → test-reports/QA_REVIEW_REPORT.md
```

---

## Step 5: 测试

```bash
# 用 curl 快速验证
curl -X POST http://43.156.46.187:9001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

agent 能直接调用的 tool：

```
code-review__report(project_path="/opt/mcp/repos/agent", language="all")
code-review__review_all(project_path="/opt/mcp/repos/agent", language="all")
code-review__review_lint(project_path="/opt/mcp/repos/agent", language="js-ts")
code-review__review_format(project_path="...", language="all")
code-review__review_types(project_path="...", language="js-ts")
code-review__review_complexity(project_path="...")
code-review__review_deps(project_path="...")
```

---

## 7 Tools 速查

| Tool | 用途 | 返回 |
|------|------|------|
| `report` | 聚合评分报告（优先用） | `{score, status, breakdown, p0_total, p1_total, top_issues}` |
| `review_all` | 全量机械检查 | 5 层结果（lint+format+types+complexity+deps） |
| `review_lint` | 仅 lint | solhint/eslint/ruff/shellcheck |
| `review_format` | 仅 format | forge-fmt/prettier/black/shfmt |
| `review_types` | 仅 type check | tsc/mypy |
| `review_complexity` | 仅复杂度 | radon/eslint |
| `review_deps` | 仅依赖审计 | npm-audit/pip-audit |

---

## 与 git-mcp 协作

code-review 审查的代码需要先通过 git-mcp 同步到 MCP 服务器：

```
git-mcp.git_pull("team3")
     │
     ▼
/opt/mcp/repos/team3/     ← 代码副本
     │
     ▼
code-review__report(project_path="/opt/mcp/repos/team3")
```

完整参考：`skills/code-review-toolkit/SKILL.md` 的「与 git-mcp 协作」章节。

---

## 排错

| 现象 | 原因 | 解决 |
|------|------|------|
| tool 列表为空 | 没重启 Gateway | `openclaw gateway restart` |
| `-32602 unknown tool` | transport 配错 | 确认用 `streamable-http` + 根路径 `:9001` |
| report 分数异常 | 服务版本 out of date | `curl :9001/health` 确认 ≥ v4.0.0 |
| 连不上 9001 | 防火墙/安全组 | 检查 43.156.46.187 安全组是否放行 9001 |
