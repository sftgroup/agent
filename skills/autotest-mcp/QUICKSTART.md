# Autotest MCP Skill — Quick Start

让 OpenClaw agent 通过 MCP 协议远程执行自动化测试（链上交易、浏览器截图、API 断言）。

## 前置条件

- OpenClaw Gateway 已运行
- 能访问 MCP 服务器 `43.156.46.187`（端口 8081/8082/8083）
- 有 `sftgroup/agent` 仓库访问权限

## 1. 安装 Skill

```bash
git clone https://github.com/sftgroup/agent.git /tmp/agent-skills
openclaw skills install /tmp/agent-skills/skills/autotest-mcp
```

验证：
```bash
openclaw skills list | grep autotest-mcp
# 应显示 ✓ ready
```

## 2. 配置 MCP 服务器

编辑 `~/.openclaw/openclaw.json`，在 `mcp.servers` 下添加：

```json
{
  "mcp": {
    "servers": {
      "autotest-web3": {
        "transport": "sse",
        "url": "http://43.156.46.187:8081/sse"
      },
      "autotest-web": {
        "transport": "sse",
        "url": "http://43.156.46.187:8082/sse"
      },
      "autotest-dapp": {
        "transport": "sse",
        "url": "http://43.156.46.187:8083/sse"
      }
    }
  }
}
```

> ⚠️ 必须用 `transport: "sse"` + `/sse` 端点，不能用 REST API `/mcp`。

或用 CLI：
```bash
openclaw mcp add autotest-web3 http://43.156.46.187:8081/sse --transport sse
openclaw mcp add autotest-web  http://43.156.46.187:8082/sse --transport sse
openclaw mcp add autotest-dapp http://43.156.46.187:8083/sse --transport sse
```

## 3. 重启 Gateway

```bash
openclaw gateway restart
```

> ⚠️ 必须重启，否则 tool 列表为空。配完 MCP 不重启是常见坑。

验证：
```bash
openclaw mcp probe
# 应看到 autotest-web3 (21 tools) / autotest-web (18 tools) / autotest-dapp (8 tools)
```

## 4. 配置 tester agent

把 `sftgroup/agent/agents/tester/AGENTS.md` 复制到你的 tester workspace：

```bash
mkdir -p ~/.openclaw/workspace/tester
curl -o ~/.openclaw/workspace/tester/AGENTS.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/AGENTS.md
```

在 `openclaw.json` 注册 tester agent：
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

## 5. 验证

spawn tester agent 测试：
```bash
openclaw spawn tester "对项目执行测试，先读 TEST_SCENARIOS 文件"
```

agent 应该能直接调用 `autotest-web3__evm_block` 等 tool 并返回结果。

## 6. 使用

### tester agent 执行测试

tester agent 收到任务后自动：
1. 读 TEST_SCENARIOS 文件
2. 分阶段调 MCP tool（CT/AT/FT）
3. 写入测试报告

### qa agent 调用测试

qa agent 审查前先跑 autotest：
```
autotest-web3__evm_contract_test(dir="/repo", ...)
autotest-web__api_get(url="...", use_auth="test")
autotest-web__browser_page_check(url="...", expect_text="...")
```

### 认证（需登录的 API）

```python
api_get(url=".../api/backtest/runs", use_auth="test")     # test:test12345
api_get(url=".../api/admin/dashboard", use_auth="admin")  # admin:admin12345
```

内置账号自动登录 + 缓存 token + 自动刷新。无 auth 端点时优雅降级。

## 返回值格式

所有 MCP Tool 统一返回三层报告：

```json
{
  "verdict": "PASS",
  "summary": "🟢 evm_contract_test | forge build ✅ | forge test(33P/0F)",
  "checks": [
    {"step": "forge build", "passed": true, "status": "✅"}
  ],
  "details": "{... 原始 JSON，只在深究问题时展开 ...}"
}
```

agent 只看 `verdict` + `summary` + `checks`，**不要解析 `details`**。

## 工具速查

### 链上测试 (autotest-web3)

| Tool | 用途 |
|------|------|
| `evm_contract_test` | 合约编译 + 跑测试 + slither |
| `evm_tx_and_verify` | 发交易 + 等 receipt + 验证 event |
| `evm_deploy_and_verify` | 部署 + 验证合约 |
| `security_audit` | Slither + Echidna + Halmos |
| `sol_deploy_and_test` | Solana anchor build + test + deploy |
| `sol_transfer_and_confirm` | Solana 转账确认 |
| `evm_balance` / `evm_call` / `evm_code` | 原子查询 |

### 前端 + API (autotest-web)

| Tool | 用途 |
|------|------|
| `browser_page_check` | 页面检查 + 截图 |
| `browser_user_flow` | 多步操作流 |
| `api_e2e_test` | 一键 API E2E（hurl） |
| `api_get` / `api_post` | 单次请求（支持 `use_auth`） |
| `api_fuzz_test` | API 模糊测试 |
| `api_load_test` | 负载测试 |
| `perf_audit_page` | Lighthouse 性能审计 |
| `security_scan` | 容器安全扫描 |

### DApp 全链路 (autotest-dapp)

| Tool | 用途 |
|------|------|
| `dapp_tx_and_ui_check` | 发链上交易 + 验证前端更新 |
| `dapp_deploy_and_ui_check` | 部署合约 + 验证前端 |
| `dapp_wallet_connect_flow` | 钱包连接（mock MetaMask） |
| `dapp_swap_flow` | Swap 全流程 |
| `dapp_sol_transfer_and_ui` | Solana 转账 + UI |

## 踩坑记录

| 坑 | 现象 | 解决 |
|----|------|------|
| 只配了 `/mcp` REST 端点 | agent 调工具报 -32602 | 必须用 `GET /sse` 端点 |
| 忘了重启 Gateway | 工具列表为空 | 配完 MCP 必须 `gateway restart` |
| agent 用 exec curl 绕过 MCP | 假阳性 | AGENTS.md 加 🔴 绝对禁令 |
| 返回原始 JSON 太大 | token 浪费 + 截断 | 框架层自动包三层报告 |
| auth 端点 404 | 需登录测试阻塞 | 等被测实现 auth，内置 test/admin 账号 |
| DApp 钱包连接 | 无 MetaMask | 注入 mock `window.ethereum` |
