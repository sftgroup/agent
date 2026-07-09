---
name: "security-audit-pipeline"
description: "三层AI安全审计流水线: qa+security+security-check(合约/中心化)。14源威胁情报+MCP入口工具。46 tools via MCP."
status: proposal
version: "v1"
date: "2026-07-09T19:33:16.899Z"
---

# Security Audit Pipeline

三层 AI Agent 安全审计流水线，覆盖合约安全审计 + 中心化应用安全审计 + 上线后生产环境安全检测。

Agent 加载此 Skill 后通过 MCP 调用 3 个入口工具完成全量审计，无需自己安装任何扫描工具。

## 核心：MCP 入口工具（Agent 只需调这 3+1 个）

### code-review — 代码机械审查（审计前先跑）

```bash
curl -X POST http://43.156.46.187:9001/api/report \
  -H 'Content-Type: application/json' \
  -d '{"project_path":"/opt/mcp/repos/<team>","language":"all"}'
```

返回 scored report: `{score, status (pass|warn|fail), breakdown, top_issues}`。
审计流程中 Step 0 先跑这个，P0>0 则阻塞，修复后通过才进安全审计。

### 安全审计 MCP Server

MCP Server 部署在 43.156.46.187:3000 (HTTP SSE)，systemd 守护。类型为 SSE (`type: "sse"`)。

### 1. contract_audit — 智能合约安全审计

```
project_path: "/opt/mcp/repos/<team>"  (必填)
scope: "all"                            (可选: all|static|dynamic|fuzz)
deployed_address: "0x..."               (可选，用于链上验证)
```

内部自动编排：`forge build → forge test → slither → aderyn → mythril → echidna → semgrep → solhint → grep secrets → npm audit`

返回归一化报告含 `summary.risk_level` (CRITICAL/HIGH/MEDIUM/LOW) + 各子工具详细结果。

### 2. centralized_audit — 中心化应用安全审计

```
project_path: "/opt/mcp/repos/<team>"  (必填)
target_url: "https://app.example.com"   (必填)
scope: "all"                            (可选: all|sast|dast|sca|infra)
language: "js"                          (可选: js|python|go|rust)
```

内部自动编排：SAST (semgrep/bandit/gosec/eslint/gitleaks) + DAST (nuclei/nikto/ZAP) + SCA (npm/pip/cargo/trivy) + Infra (nmap/lynis) + Compliance (testssl/cors/headers/whatweb)

### 3. production_audit — 上线后生产安全审计

```
target_url: "https://app.example.com"   (必填)
domain: "all"                           (可选)
apk_path: "/tmp/app.apk"                (可选)
deep: false                             (可选，深度扫描模式)
```

内部自动编排：SQL注入/XSS/Wapiti/目录爆破/子域名 + CORS/Headers/SSL/Cookie/JWT/RateLimit + APK分析/密钥扫描 + 端口扫描/SSH/指纹 + OWASP ZAP

### 可选：威胁情报查询 (6 tools)

`update_knowledge_base` / `query_intelligence` / `get_latest_attacks` / `check_cve` / `compare_snapshots` / `search_ttp`

审计前建议先调 `query_intelligence(category="defi")` 获取最新攻击情报注入上下文。

## 项目类型 → 路由

| 特征 | 审计入口 |
|------|---------|
| 含 `contracts/src/*.sol` + `foundry.toml` | `contract_audit` |
| 无合约文件 (Node.js/React/Python/Go) | `centralized_audit` |
| 两者都有 | `contract_audit` + `centralized_audit` |
| 已上线(有 URL/APK) | 上述 + `production_audit` |

## 审计流程

1. 判断项目类型 → 选入口工具
2. 调 `query_intelligence` 加载最新攻击情报
3. 调 `contract_audit` / `centralized_audit` / `production_audit`
4. 读返回的 `summary.risk_level` + 各子工具详细结果
5. `CRITICAL` / `HIGH` → 修复 → 重新审计回归
6. 将最终报告写入 `test-reports/SECURITY_AUDIT_REPORT.md`

## 严重度标准 (Immunefi + OWASP)

| Level | 合约 (Immunefi) | 中心化 (OWASP) |
|-------|-------------------|-------------------|
| 🔴 Critical | ≥$100K loss, unrestricted fund drain | RCE, 数据泄露, 认证绕过 |
| 🟠 High | Single-point breach, privileged exploit | XSS/SSRF/IDOR, 逻辑绕过 |
| 🟡 Medium | Conditional combo, gas griefing | 配置不当, 信息泄露 |
| 🟢 Low | Best practice, style | Headers, cookies, 指纹 |