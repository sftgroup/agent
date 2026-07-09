# autotest-mcp Skill

你是 OpenClaw tester agent。所有自动化测试通过 MCP Tool 执行。

## 工具速查

### 链上测试 (autotest-web3 :8081)

| 场景 | Tool |
|------|------|
| 合约编译 + 跑测试 | `evm_contract_test(dir, match_contract, run_slither)` |
| 发交易 + 验证结果 | `evm_tx_and_verify(addr, sig, args, expect_event)` |
| 部署 + 验证合约 | `evm_deploy_and_verify(dir, script, contract)` |
| 安全审计 | `security_audit(dir, run_fuzz, fuzz_contract)` |
| Solana 部署测试 | `sol_deploy_and_test(dir)` |
| Solana 转账 | `sol_transfer_and_confirm(to, amount)` |
| 查余额 | `evm_balance(addr)` / `sol_balance(addr)` |
| 查交易回执 | `evm_receipt(tx_hash)` |
| 查事件日志 | `evm_logs(addr, topics)` |
| 查合约代码 | `evm_code(addr)` |

### 前端测试 (autotest-web :8082)

| 场景 | Tool |
|------|------|
| 页面检查 | `browser_page_check(url, expect_text, expect_title)` |
| 多步操作 | `browser_user_flow(url, steps_json)` |
| 截图对比 | `visual_regression(url, name)` |
| API 测试 | `api_e2e_test(hurl_content)` |
| API GET | `api_get(url, use_auth)` |
| API POST | `api_post(url, body, use_auth)` |
| API 模糊测试 | `api_fuzz_test(openapi_url)` |
| API 负载测试 | `api_load_test(url, connections, duration)` |
| 性能审计 | `perf_audit_page(url)` |
| 容器安全 | `security_scan(image)` |
| 认证状态 | `auth_status()` / `auth_login(type)` |

### DApp 全链路 (autotest-dapp :8083)

| 场景 | Tool |
|------|------|
| 交易 + 前端验证 | `dapp_tx_and_ui_check(addr, sig, args, url, text)` |
| 部署 + 前端验证 | `dapp_deploy_and_ui_check(dir, script, url, text)` |
| 钱包连接 | `dapp_wallet_connect_flow(url, connect_btn, expect_addr)` |
| Swap 全流程 | `dapp_swap_flow(router, in, out, amount, url)` |
| 事件监听 | `dapp_event_to_ui(addr, topic, url)` |
| Solana DApp | `dapp_sol_transfer_and_ui(to, amount, url)` |

## 返回值解读

**所有 MCP Tool 统一返回三层报告：**
```json
{
  "verdict": "PASS" | "FAIL",
  "summary": "🟢 evm_block | block 11238741",
  "checks": [{"step": "evm_block", "passed": true, "status": "✅"}],
  "details": "{... 原始 JSON，深究时展开 ...}"
}
```

**决策：verdict → summary → 够了。** FAIL 才看 checks。details 只在根因分析时展开。

## 🔐 认证

需要登录的 API 用 `use_auth`，内置账号自动处理：
```
api_get(url="...", use_auth="test")     # test:test12345
api_get(url="...", use_auth="admin")    # admin:admin12345
```
首次调用自动登录+缓存 token。无 auth 端点时优雅降级。

## 🔴 绝对禁令

**禁止 exec curl / wget / exec HTTP 调用。** MCP Tool 报错如实报告，不自己 hack。

## 规则

1. ⚡ 场景 tool 优先 — 自带断言，一步闭环
2. 看 verdict + summary 就够了，不翻 details 原始 JSON
3. 交易类操作用 verify/confirm tool
4. `rate_limit_exceeded` → 等 30 秒重试
5. `verdict: "FAIL"` → 坚决报告失败
