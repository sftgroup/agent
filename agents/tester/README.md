# Tester Agent 优化记录

## 背景

tester agent 从 **autotest CLI** 模式迁移到 **MCP Tool** 模式，经历了两轮优化。

## 从 autotest CLI → MCP Tool（v10→v11）

### 旧模式（autotest CLI）

```
tester 收到任务
  → autotest selfcheck       # 本地检查
  → autotest run --scope ct  # 本地执行
  → 分析输出 → 写报告
```

**问题**：
- autotest CLI 是本地脚本，每次调用走 exec/curl，无法结构化验证
- "发交易 → 记 PASS" 模式，没有 receipt 确认（假阳性）
- 环境依赖分散在 OpenClaw 本地，每台机器都要装 forge/cast/playwright
- 测试报告靠人工从输出中 grep 提取状态

### 新模式（MCP Tool）

```
tester 收到任务
  → evm_contract_test(dir)         # MCP Tool，forge build + test 一步完成
  → evm_tx_and_verify(addr, sig)    # MCP Tool，等 receipt + 自动断言
  → browser_page_check(url, text)   # MCP Tool，截图 + 文字验证
  → 直接从 tool 返回值取 passed
```

**优势**：
- 结构化返回值，`passed` 字段直接决定结论
- 交易 tool 内部等回执、验证事件，杜绝假阳性
- 所有工具装在 MCP 服务器（43.156.46.187），OpenClaw 实例无需安装
- 45 个 tool 覆盖 EVM/Solana/Browser/API/Security/DApp

## 第二轮优化（AGENTS.md 去版本化）

### 去掉的内容

1. **版本号** — "v11.0" 是设计阶段的标记，上线后不再有意义
2. **`test_health` 前置调用** — 当前 MCP 框架下，tool 不可用时直接报错，不需要独立的健康检查
3. **`test_auto_install` 概念** — 工具装在远程服务器上，本地 agent 不需要触发安装
4. **与 verifier 的边界** — tester 当前独立使用，不需要对比文档
5. **SSH 隧道说明** — MCP 服务器直接暴露端口（安全组控制），不需要隧道
6. **颗粒化拆分规则** — 当前不需要子进程拆分，降低复杂度

### 保留的核心

- MCP Tool 映射表（20 个场景 tool + 降级原子 tool）
- 工作流（CT→AT→FT→BT→DApp）
- `passed` 字段判定规则
- 假阳性杜绝对照表
- 报告模板
- 异常处理

## 部署架构

```
OpenClaw 实例（任意机器）
  │
  │ MCP SSE (http://43.156.46.187:808x/sse)
  │
  ▼
MCP 服务器 (43.156.46.187, 4C8G)
  ├── autotest-web3 (:8081) — forge/cast/solana/slither
  ├── autotest-web  (:8082) — playwright/hurl/lighthouse/backstopjs
  └── autotest-dapp (:8083) — 链+前端全链路
```

- 三个服务都是 systemd 管理，开机自启
- 工具环境自动检测（env_checker.py），缺失时自动安装
- 速率限制内置于 auth_guard.py（写操作 10/min，fuzz/load 2-3/min）
