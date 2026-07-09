# Autotest MCP — Quick Start

让 OpenClaw agent 通过 MCP 协议远程执行自动化测试（链上交易 + 浏览器 + API），**5 步搞定**。

## 前置条件

- OpenClaw Gateway 已运行
- 能访问 MCP 服务器 43.156.46.187（端口 8081/8082/8083）

---

## Step 1: 装 Skill

```bash
git clone https://github.com/sftgroup/agent.git /tmp/agent-skills
openclaw skills install /tmp/agent-skills/skills/autotest-mcp
```

验证：

```bash
openclaw skills list | grep autotest-mcp
# 应显示 ✓ ready
```

---

## Step 2: 注册 MCP

```bash
openclaw mcp add autotest-web3 \
  --url http://43.156.46.187:8081/sse \
  --transport sse \
  --timeout 300

openclaw mcp add autotest-web \
  --url http://43.156.46.187:8082/sse \
  --transport sse \
  --timeout 300

openclaw mcp add autotest-dapp \
  --url http://43.156.46.187:8083/sse \
  --transport sse \
  --timeout 300
```

⚠️ 用 `sse` transport + `/sse` 端点，**不要用 streamable-http**。

---

## Step 3: 重启 Gateway

```bash
openclaw gateway restart
```

⚠️ 必须重启，否则 tool 列表为空。配完 MCP 不重启是常见坑。

验证：

```bash
openclaw mcp probe | grep autotest
# 应看到:
#   autotest-web3: 21 tools
#   autotest-web: 18 tools
#   autotest-dapp: 8 tools
```

---

## Step 4: 配置 tester agent

### 4.1 复制 AGENTS.md

```bash
mkdir -p ~/.openclaw/workspace/tester
curl -o ~/.openclaw/workspace/tester/AGENTS.md \
  https://raw.githubusercontent.com/sftgroup/agent/master/agents/tester/AGENTS.md
```

### 4.2 注册 agent

在 `openclaw.json` 的 `agents` 段加：

```json
{
  "agents": {
    "tester": {
      "agentId": "tester",
      "workspace": "~/.openclaw/workspace/tester",
      "toolsAllow": ["autotest-*"]
    }
  }
}
```

### 4.3 定制 AGENTS.md（按项目类型）

| 项目类型 | 保留 | 删除 |
|----------|------|------|
| 纯 Web | AT + FT（api/browser） | CT / DApp |
| DApp | CT + AT + FT + DApp | 无 |
| 纯合约 | CT + BT（evm/security） | AT / FT / DApp |

打开 AGENTS.md → 删掉不需要的测试阶段 → 5 分钟搞定。

### 4.4 QA agent 加测试引用

QA 的 AGENTS.md 加：

```markdown
## 审查前先跑 autotest

Step 0: autotest 机械测试
  autotest-web3__evm_contract_test(dir="/opt/mcp/repos/<team>", ...)
  autotest-web__api_e2e_test(hurl_content="...")
  → 结果看 verdict + summary

Step 1: 按 verdict 决策
  PASS → 进入 L1/L2 人工审查
  FAIL → 标注 P0 → 修 → 重跑
```

---

## Step 5: 测试

```bash
openclaw spawn tester "对项目执行测试，先读 TEST_SCENARIOS 文件"
```

agent 能直接调用的 tool：

```
autotest-web3__evm_contract_test(dir, match_contract, run_slither)
autotest-web3__evm_tx_and_verify(addr, sig, args, expect_event)
autotest-web__browser_page_check(url, expect_text, expect_title)
autotest-web__api_e2e_test(hurl_content)
autotest-web__api_get(url, use_auth="test")
autotest-dapp__dapp_wallet_connect_flow(url, connect_btn)
autotest-dapp__dapp_swap_flow(router, in, out, amount, url)
```

**47 tools 总数，agent 自动发现。**

---

## 47 Tools 速查

### autotest-web3 (21 tools) — 链上

| Tool | 用途 |
|------|------|
| `evm_contract_test` | 合约编译 + 测试 + slither |
| `evm_tx_and_verify` | 发交易 + receipt + event |
| `evm_deploy_and_verify` | 部署 + 验证 |
| `security_audit` | Slither + Echidna + Halmos |
| `sol_deploy_and_test` | Solana anchor build + deploy |
| `sol_transfer_and_confirm` | Solana 转账 |
| `evm_balance` / `evm_call` / `evm_code` / … | 原子查询 |

### autotest-web (18 tools) — 前端 + API

| Tool | 用途 |
|------|------|
| `browser_page_check` | 页面检查 + 截图 |
| `browser_user_flow` | 多步操作流 |
| `api_e2e_test` | API E2E（hurl） |
| `api_get` / `api_post` | 单次请求（支持 `use_auth`） |
| `api_fuzz_test` | 模糊测试 |
| `api_load_test` | 负载测试 |
| `perf_audit_page` | Lighthouse |
| `security_scan` | 容器安全 |

### autotest-dapp (8 tools) — DApp 全链路

| Tool | 用途 |
|------|------|
| `dapp_tx_and_ui_check` | 链上交易 + 前端验证 |
| `dapp_deploy_and_ui_check` | 部署 + 前端验证 |
| `dapp_wallet_connect_flow` | 钱包连接（mock MetaMask） |
| `dapp_swap_flow` | Swap 全流程 |
| `dapp_sol_transfer_and_ui` | Solana 转账 + UI |

---

## 返回值格式

所有 tool 统一返回三层报告：

```json
{
  "verdict": "PASS",
  "summary": "🟢 evm_contract_test | forge build ✅ | forge test(33P/0F)",
  "checks": [{"step": "forge build", "passed": true, "status": "✅"}],
  "details": "{... 原始 JSON，只在深究时展开 ...}"
}
```

agent 只看 `verdict` + `summary` + `checks`，**不要解析 `details`**。

---

## 认证

需登录 API 用 `use_auth`（内置账号自动处理）：

```
api_get(url="...", use_auth="test")      # test:test12345
api_get(url="...", use_auth="admin")     # admin:admin12345
```

---

## 排错

| 现象 | 原因 | 解决 |
|------|------|------|
| tool 列表为空 | 没重启 Gateway | `openclaw gateway restart` |
| `-32602 unknown tool` | transport 配错 | 确认用 `sse` + `/sse` 端点 |
| agent 用 exec curl 绕过 | AGENTS.md 没加禁令 | 加 🔴 绝对禁令段 |
| probe 500 | Python pycache 缓存旧代码 | `rm -rf __pycache__` + 重启 |
| 连不上 8081-8083 | 防火墙/安全组 | 确认安全组放行端口 |
| auth 端点 404 | 被测项目无 auth | `use_auth` 优雅降级，正常 |
| DApp 钱包连接 | 无 MetaMask | 已注入 mock `window.ethereum` |
