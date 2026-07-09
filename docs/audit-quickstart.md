# Audit Quickstart — 5 分钟接入代码审查 + 安全审计流水线

> stevenwang 管理的 OpenClaw 实例统一接入。复制粘贴即可，零手动工具安装。

---

## 前置条件

1. OpenClaw 实例在运行
2. IP 已加入 43.156.46.187 安全组白名单（找 stevenwang）
3. 知道自己的 team 名称（如 team1、team5）

---

## 3 步接入

### ① 拉仓库 + 复制 Skills

```bash
git clone https://github.com/sftgroup/agent.git /tmp/sftgroup-agent

# 必选：安全审计流水线 (46 tools MCP)
cp -r /tmp/sftgroup-agent/skills/security-audit-pipeline ~/.openclaw/skills/security-audit-pipeline

# 必选：代码审查 (15 种 lint 工具)
cp -r /tmp/sftgroup-agent/skills/code-review-toolkit ~/.openclaw/skills/code-review-toolkit

# 必选：实例诊断 + 缓存优化
cp -r /tmp/sftgroup-agent/skills/openclaw-instance-doctor ~/.openclaw/skills/openclaw-instance-doctor

rm -rf /tmp/sftgroup-agent
```

### ② 注册 MCP 工具

编辑 `~/.openclaw/openclaw.json`，加入 `tools.mcpServers`：

```json5
{
  "tools": {
    "mcpServers": {
      // 代码审查（15 种 lint 工具，REST API + MCP JSON-RPC）
      "code-review": {
        "type": "http",
        "url": "http://43.156.46.187:9001"
      },
      // 安全审计（46 个工具自动编排，3 个入口）
      "security-tools": {
        "type": "sse",
        "url": "http://43.156.46.187:3000/sse"
      }
    }
  }
}
```

重启 Gateway：

```bash
openclaw gateway restart
```

### ③ 复制 Agent 模板

```bash
# sftgroup/agent 仓库 agents/templates/ 下的模板直接作为子 agent 的 AGENTS.md：
#   01-qa.md                    → QA 审查（含 code-review REST API）
#   02-security.md              → 合约深度审计（MCP contract_audit）
#   03-security-check-contracts.md   → 合约自动扫描（MCP contract_audit）
#   04-security-check-centralized.md → 中心化扫描（MCP centralized_audit + production_audit）

# 示例：配 QA 子代理
mkdir -p ~/.openclaw/workspace/subagents/qa
curl -s https://raw.githubusercontent.com/sftgroup/agent/master/agents/templates/01-qa.md \
  > ~/.openclaw/workspace/subagents/qa/AGENTS.md
```

---

## 验证

```bash
# MCP 连通性
curl http://43.156.46.187:9001/health          # → code-review v3.3.0
curl http://43.156.46.187:3000/health          # → security-tools 46 tools
curl http://43.156.46.187:9001/api/tools       # → REST API 工具列表

# 聚合报告（推荐：一步拿得分+分解+top_issues）
curl -X POST http://43.156.46.187:9001/api/report \
  -H 'Content-Type: application/json' \
  -d '{"project_path":"/opt/mcp/repos/<team>","language":"all"}'
# → {score, status (pass|warn|fail), breakdown, top_issues}

# 原始明细（需要深入某个工具时用）
curl -X POST http://43.156.46.187:9001/api/review \
  -H 'Content-Type: application/json' \
  -d '{"project_path":"/opt/mcp/repos/<team>","language":"all"}'
```

---

## 如何使用（spawn 子 agent）

spawn 前架构师先 `git-mcp.repo_sync` 同步代码到 `/opt/mcp/repos/<team>/`。

### QA 审查

```
agentId="qa", taskName="qa-review"
task="项目根目录: {项目根目录}

⚠️ 架构师已通过 git-mcp 同步代码到 /opt/mcp/repos/<team>/。

审查目标: {模块}
审查层级: L1+L2+L3

Step 0 — 调 code-review REST API：
  curl -X POST http://43.156.46.187:9001/api/report \
    -d '{"project_path":"/opt/mcp/repos/<team>","language":"all"}'
  返回 scored report: score/100, status (pass|warn|fail), breakdown per-tool
  status=fail (P0>0) → 架构师修复 → 重新调 → P0=0

Step 1-3 — L1→L2→L3 人工审查
产出: {项目根目录}/test-reports/QA_REVIEW_REPORT.md"
```

### 合约安全审计

```
agentId="security", taskName="sec-audit"
task="项目根目录: {项目根目录}
→ security-tools.contract_audit(project_path=/opt/mcp/repos/<team>)
→ 分析 + 威胁建模 + SCSVS 复查
→ {项目根目录}/test-reports/SECURITY_REVIEW_REPORT.md"
```

### 合约自动扫描

```
agentId="security-check", taskName="sec-scan"
task="项目根目录: {项目根目录}
→ security-tools.contract_audit(project_path=/opt/mcp/repos/<team>)
→ 标注 CVE + 修复版本
→ {项目根目录}/test-reports/SECURITY_SCAN_REPORT.md"
```

### 中心化应用扫描

```
agentId="security-check-centralized", taskName="sec-scan-cent"
task="项目根目录: {项目根目录}
→ security-tools.centralized_audit(project_path=/opt/mcp/repos/<team>, target_url=<url>)
→ 标注 CVE + 修复版本
→ {项目根目录}/test-reports/SECURITY_SCAN_REPORT_CENTRALIZED.md"
```

---

## MCP 服务器信息

| 服务 | 端口 | 协议 | 工具数 | 说明 |
|------|:---:|------|:---:|------|
| code-review | 9001 | HTTP + REST API | 6+''report' | lint/format/types/complexity/deps + 聚合报告 |
| security-tools | 3000 | SSE | 46 | contract/centralized/production audit |
| git-mcp | 3082 | HTTP | 19 | repo sync/push/pull/audit |
| build-mcp | 3081 | HTTP | 6 | npm/docker/mobile build |

> 全部 43.156.46.187，systemd 管理，自动重启。

---

## 接入后：清理本地冗余工具

```bash
# 安全扫描工具（MCP 已替代）
pip3 uninstall -y --break-system-packages slither-analyzer mythril bandit semgrep pip-audit 2>/dev/null
sudo rm -f /usr/local/bin/{gitleaks,trivy,nuclei,echidna,aderyn}
sudo apt-get remove -y nmap 2>/dev/null
pip3 cache purge
```

> 保留 eslint、prettier、tsc、solhint、ruff、black、mypy、radon（本地开发用）

释放约 500MB/实例，AGENTS.md 从 754 行精简到 222 行（-70%）。

---

## 缓存优化（推荐）

```bash
openclaw gateway stop
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/fix-config.sh
openclaw gateway start
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/diagnose.sh
# → 7/7 ✅ 缓存命中率从 ~50% → 82%
```

---

## 常见问题

**Q: 外网连不上 MCP？**
A: IP 需加入 43.156.46.187 安全组白名单，找 stevenwang。

**Q: code-review 返回 "项目路径不在白名单"？**
A: 项目必须在 `/opt/mcp/repos/<team>/` 下。先 `git-mcp.repo_sync` 同步。

**Q: security-tools 用什么 transport？**
A: `"type": "sse"`（security-tools MCP 目前只支持 SSE，不支持 streamable-http）。

**Q: 不用 MCP 能直接用 curl 调吗？**
A: code-review 支持 REST API。推荐 `/api/report`（聚合报告）和 `/api/review`（原始明细）。
```bash
curl http://43.156.46.187:9001/api/report -d '{"project_path":"/opt/mcp/repos/<team>"}'
```

**Q: 能装在自己服务器上吗？**
A: 可以。把 `sftgroup/agent/skills/` 下对应的 Skill 复制过去，运行 `install-linters.sh`，改 systemd 监听端口即可。

**Q: 工具版本不一致怎么办？**
A: `install-linters.sh` 已锁定所有 15 个工具版本号，全平台结果一致。
