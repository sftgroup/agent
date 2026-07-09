# Code Review Skill — Apply 指南

## 概述

code-review-toolkit 是一套标准的 Skill + Tool + MCP 三层架构：

```
Skill（SKILL.md）→ 告知 agent 何时/如何调用
Tool（MCP 6 tools） → 统一接口，JSON-RPC 调用
MCP Server（server.py）→ 运行在 43.156.46.187:9001，纯本地文件系统
```

## 前置条件

- MCP 服务器：43.156.46.187:9001 已部署
- 15 种 lint 工具全部安装完毕
- 代码管理 MCP 已将项目同步到 `/opt/mcp/repos/<team>/`
- 腾讯云安全组：9001 端口已放行

## 其他 Agent 如何 Apply

### Step 1: 复制 Skill 文件

```bash
# 从 GitHub 仓库拉取
git clone git@github.com:sftgroup/agent.git /tmp/agent-repo
cp -r /tmp/agent-repo/skills/code-review-toolkit ~/.openclaw/skills/code-review-toolkit
```

### Step 2: 注册 MCP 到 OpenClaw

编辑 `~/.openclaw/openclaw.json`，在 `mcp.servers` 中添加：

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

### Step 3: 验证连通性

```bash
# 健康检查
curl http://43.156.46.187:9001/health
# → {"status":"ok","version":"3.1.0","mode":"local"}

# 验证 tool 列表
curl -s -X POST http://43.156.46.187:9001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | python3 -c "import json,sys; print([t['name'] for t in json.load(sys.stdin)['result']['tools']])"
# → ['review_lint', 'review_format', 'review_types', 'review_complexity', 'review_deps', 'review_all']
```

### Step 4: 在 AGENTS.md 中添加调度规则

```markdown
## 代码审查流程

每次代码变更完成后：
1. 确保代码管理 MCP 已执行 repo_sync
2. 调用 code-review MCP 的 review_all:
   - project_path: /opt/mcp/repos/<team>/
   - language: all
3. 根据返回的 P0/P1/P2 问题修复
4. 重新 sync → review → 确认清零
5. 再进行 QA AI review 和 security 审计
```

## 工作流模板（Agent 内部调用）

```
1. 代码管理 MCP: repo_sync(team="team3", source_host="43.156.50.6", source_path="/home/ubuntu/.openclaw/workspace/team3")
   → 返回: {"sha": "abc123", "status": "synced"}

2. Code Review MCP: review_all(project_path="/opt/mcp/repos/team3", language="all")
   → 返回: {"status": "ok", "summary": "...", "results": {"lint": {...}, "format": {...}, ...}}

3. 根据 results 修复 P0/P1 问题

4. 回到 Step 1（重新 sync），再 Step 2（确认清零）

5. QA 子代理: AI review（逻辑/边界/UX），报告标注 reviewed_sha: abc123

6. Security 子代理: 深度审计，报告标注 reviewed_sha: abc123
```

## 6 个 Tool 速查

| Tool | 参数 | 返回 |
|------|------|------|
| `review_lint` | `project_path`, `language` | solhint/eslint/ruff/shellcheck 结果 |
| `review_format` | `project_path`, `language` | forge fmt/prettier/black/shfmt 结果 |
| `review_types` | `project_path`, `language` | tsc/mypy 类型错误 |
| `review_complexity` | `project_path` | radon 圈复杂度 + eslint 函数长度 |
| `review_deps` | `project_path` | npm audit + pip-audit 漏洞 |
| `review_all` | `project_path`, `language` | 以上全部汇总 |

`language` 枚举：`solidity` / `js-ts` / `python` / `shell` / `all`

## 服务信息

| 项目 | 值 |
|------|-----|
| 服务器 | 43.156.46.187 |
| 端口 | 9001 |
| 协议 | Streamable HTTP (JSON-RPC 2.0) |
| systemd | code-review-mcp.service |
| 健康检查 | `curl http://43.156.46.187:9001/health` |

## Troubleshooting

| 问题 | 检查 |
|------|------|
| 连接超时 | 安全组是否放行 9001？ |
| `project not found` | 代码管理 MCP 是否已同步？项目路径是否正确？ |
| `tool not found : eslint` | MCP 服务器是否按 install-linters.sh 装过工具？ |
| 路径被拒绝 | `project_path` 是否在 `/opt/mcp/repos/` 下？ |
| 返回为空 | 项目中是否有对应语言的文件？ |
