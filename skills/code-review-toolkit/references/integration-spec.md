# Code Review MCP — 接口规范 v1.0

## 概述

code-review MCP 是纯本地文件系统模式的代码质量审查服务。它不管理代码生命周期（clone/pull/push），只审查已存在于服务器本地文件系统上的项目代码。

代码同步由**代码管理 MCP**（code-mgmt）负责。

## 上游依赖

code-review MCP 依赖代码管理 MCP 满足以下前置条件：

| 条件 | 说明 |
|------|------|
| 项目存在于本地 | `/opt/mcp/repos/<team>/` 目录下有完整项目文件 |
| `node_modules` 已安装 | JS/TS 项目需要（eslint/prettier/tsc 依赖） |
| `foundry.toml` 存在 | Solidity 项目需要（forge fmt 依赖） |
| Python 虚拟环境 | 非必须，但有 `.venv` 时 mypy 更准确 |

## 目录约定

```
/opt/mcp/repos/
├── team1/          ← 代码管理 MCP 同步
├── team2/          ← 代码管理 MCP 同步
├── team3/          ← 代码管理 MCP 同步
├── team4/          ← 代码管理 MCP 同步
├── team5/          ← 代码管理 MCP 同步
├── team6/          ← 代码管理 MCP 同步
└── team3-backup/   ← 代码管理 MCP 同步
```

> 路径可变。只需 code-review 调用时传正确的 `project_path` 即可。

## 工具列表

| Tool | 参数 | 返回 |
|------|------|------|
| `review_lint` | `project_path`, `language` | `{ issueCount, issues: [{tool, file, message, severity}] }` |
| `review_format` | `project_path`, `language` | `{ language: {ok, output} }` |
| `review_types` | `project_path`, `language` | `{ language: {ok, errors} }` |
| `review_complexity` | `project_path` | `{ python: [...], typescript: [...] }` |
| `review_deps` | `project_path` | `{ npm: {...}, python: [...] }` |
| `review_all` | `project_path`, `language` | 以上全部汇总 |

## 语言枚举

| 值 | 覆盖 | 对应工具 |
|----|------|---------|
| `solidity` | `.sol` | solhint, forge fmt |
| `js-ts` | `.ts`, `.tsx`, `.js`, `.jsx` | eslint, prettier, tsc |
| `python` | `.py` | ruff, black, mypy, radon |
| `all` | 以上全部 | 全部 |

## 严重度定义

| 级别 | 含义 | 示例 |
|------|------|------|
| **P0** | 阻断性错误 | TypeScript 类型错误、Python 类型不匹配 |
| **P1** | 应修复 | Lint 违规、格式不一致 |
| **P2** | 建议优化 | 圈复杂度过高、函数过长 |

## 调用示例

```json
// review_all — 全量审查
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "review_all",
    "arguments": {
      "project_path": "/opt/mcp/repos/team3",
      "language": "all"
    }
  }
}
```

```json
// review_lint — 仅 lint
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "review_lint",
    "arguments": {
      "project_path": "/opt/mcp/repos/team3",
      "language": "solidity"
    }
  }
}
```

## 错误处理

| 情况 | 返回 |
|------|------|
| 项目路径不存在 | `{"error": "project not found: /path"}` |
| 工具未安装 | `{"tool": "solhint", "message": "tool not found", "severity": "P2"}` |
| 无匹配文件 | `{"project": "/path", "language": "solidity", "issueCount": 0, "issues": []}` |

## 接入 checklist

- [ ] 代码管理 MCP 已在 43.156.46.187 上部署
- [ ] 项目已同步到 `/opt/mcp/repos/<team>/`
- [ ] MCP 服务器已安装 lint 工具（solhint/eslint/ruff 等）
- [ ] OpenClaw 实例 MCP 配置已指向 `http://43.156.46.187:9001/mcp`
- [ ] 安全组 9001 端口已放行
- [ ] `curl http://43.156.46.187:9001/health` 返回 `{"status": "ok"}`

## 不负责

- ❌ 代码同步（clone/pull/fetch）→ 代码管理 MCP
- ❌ Git 操作（commit/push/merge）→ 代码管理 MCP
- ❌ 安全检查（漏洞扫描/攻击面）→ security-check 子代理
- ❌ 功能测试（E2E/forge test）→ tester 子代理
