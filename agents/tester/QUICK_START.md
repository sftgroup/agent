# Autotest MCP — Quick Start

> 让其他 OpenClaw 实例接入 MCP 测试服务器，踩坑经验总结。

## 架构

```
你的 OpenClaw 实例 (任意机器)
    │
    ├── MCP Tool: autotest-web3  ---> 43.156.46.187:8081/sse (EVM + Solana)
    ├── MCP Tool: autotest-web   ---> 43.156.46.187:8082/sse (浏览器 + API)
    └── MCP Tool: autotest-dapp  ---> 43.156.46.187:8083/sse (DApp 全链路)
```

**45 个 MCP Tool**，所有测试真实执行（链上交易、浏览器截图、API 断言），0 假阳性。

## 1. 配置 MCP（2 分钟）

打开你的 `openclaw.json`，加三条 MCP 配置：

```json
{
  "plugins": {
    "entries": {
      "mcp": {
        "config": {
          "servers": {
            "autotest-web3": {
              "url": "http://43.156.46.187:8081/sse",
              "transport": "sse"
            },
            "autotest-web": {
              "url": "http://43.156.46.187:8082/sse",
              "transport": "sse"
            },
            "autotest-dapp": {
              "url": "http://43.156.46.187:8083/sse",
              "transport": "sse"
            }
          }
        }
      }
    }
  }
}
```

或用 CLI 添加：
```bash
openclaw mcp add autotest-web3 http://43.156.46.187:8081/sse --transport sse
openclaw mcp add autotest-web  http://43.156.46.187:8082/sse --transport sse
openclaw mcp add autotest-dapp http://43.156.46.187:8083/sse --transport sse
```

**重启 Gateway**（必须）：
```bash
openclaw gateway restart
```

重启后 OpenClaw 自动拉取 tool 列表并注入到 agent 的可用 tool 中。

## 2. 配置 tester agent

### 2.1 复制 AGENTS.md

```bash
mkdir -p ~/.openclaw/workspace/tester
curl -o ~/.openclaw/workspace/tester/AGENTS.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/AGENTS.md
```

### 2.2 注册 tester 子 agent

在 `openclaw.json` 加：
```json
{
  "agents": {
    "tester": {
      "agentId": "tester",
      "model": "deepseek/deepseek-v4-pro",
      "workspace": "~/.openclaw/workspace/tester",
      "toolsAllow": ["autotest-*"]
    }
  }
}
```

### 2.3 复制 skill（可选，增强）

```bash
curl -o ~/.openclaw/workspace/skills/autotest-mcp/SKILL.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/autotest-mcp-skill.md
```

## 3. 使用

```bash
openclaw spawn tester "对项目 X 执行全量测试，先读 TEST_SCENARIOS 文件"
```

或者从飞书/Discord 群里 @ 你的 tester agent。

## 4. 返回值格式

所有 MCP Tool 统一返回三层报告：

```json
{
  "verdict": "PASS",
  "summary": "🟢 evm_contract_test | forge build ✅ | forge test(33P/0F)",
  "checks": [
    {"step": "forge build", "passed": true, "status": "✅"},
    {"step": "forge test", "passed": true, "status": "✅"}
  ],
  "details": "{... 原始 JSON，只在深究问题时展开 ...}"
}
```

agent 只看 `verdict` + `summary` + `checks`，不要解析 `details`。

## 5. 认证（需登录的 API）

API 测试用 `use_auth` 参数，内置账号自动处理：

```
api_get(url=".../api/backtest/runs", use_auth="test")     # test:test12345
api_get(url=".../api/admin/dashboard", use_auth="admin")   # admin:admin12345
api_post(url=".../api/submit", body="...", use_auth="test")
```

首次调用自动登录并缓存 token，自动刷新。无 auth 端点时优雅降级。

## 6. 工具速查

| 类别 | 常用工具 |
|------|---------|
| 合约 | `evm_contract_test` `evm_tx_and_verify` `evm_deploy_and_verify` `security_audit` |
| Solana | `sol_deploy_and_test` `sol_transfer_and_confirm` |
| 浏览器 | `browser_page_check` `browser_user_flow` `visual_regression` |
| API | `api_e2e_test` `api_get` `api_post` `api_fuzz_test` `api_load_test` |
| DApp | `dapp_tx_and_ui_check` `dapp_wallet_connect_flow` `dapp_swap_flow` |

完整列表：agent 可调 `tools/list` 查看。

## 7. 踩坑记录

| 坑 | 现象 | 解决 |
|----|------|------|
| **只配了 /mcp 没配 SSE** | agent 调工具报 -32602 | 必须用 `GET /sse` 端点，不能用 REST API `/mcp` |
| **忘了重启 Gateway** | 工具列表为空 | 配完 MCP 必须 `openclaw gateway restart` |
| **agent 用 exec curl 绕过 MCP** | 测试结果全是假阳性 | AGENTS.md 加 🔴 绝对禁令：禁止 exec curl/wget/HTTP |
| **api_post 缺 import** | 工具静默崩溃，agent fallback 到 curl | 补 `import urllib.request, ssl` |
| **FastMCP 不兼容** | SSE 连接 -32602 error | 换成标准 `mcp_sse_server.py`（Starlette + sse-starlette） |
| **返回原始 JSON 太大** | token 浪费 + 上下文截断 | 框架层统一包三层报告（verdict/summary/details） |
| **auth 端点 404** | 所有需登录测试阻塞 | 等被测项目实现 auth 路由，内置 test/admin 账号 |
| **DApp 钱包连接** | 无法测试连接流程 | 注入 mock `window.ethereum/solana`，DAPP_TEST_PK 配置 |

## 8. 安全

- MCP 服务器部署在 43.156.46.187，端口 8081-8083
- 通过 Tencent Cloud 安全组控制访问（只开放给 OpenClaw 实例 IP）
- 不需要 SSL，不走公网
- 私钥配置在服务器 `.env` 中，不在 agent 层面暴露

## 9. 更新

```bash
# 拉最新 AGENTS.md
curl -o ~/.openclaw/workspace/tester/AGENTS.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/AGENTS.md

# 重启生效
openclaw gateway restart
```
