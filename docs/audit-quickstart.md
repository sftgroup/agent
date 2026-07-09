# Audit Quickstart — 5 分钟接入代码审查 + 实例诊断

> 适用于 stevenwang 管理的其他 OpenClaw 实例。引用 `sftgroup/agent` 仓库的 Skill 和 MCP 工具。

---

## 前置条件

1. 你的 OpenClaw 实例在运行
2. 你的 IP 已被加入服务器（43.156.46.187）的安全组白名单
3. 知道自己的 team 名称（如 team1、team5）

---

## 3 步接入

### ① 拉取仓库

```bash
git clone https://github.com/sftgroup/agent.git /tmp/sftgroup-agent
```

### ② 复制 Skills

```bash
# 必选：代码审查工具
cp -r /tmp/sftgroup-agent/skills/code-review-toolkit ~/.openclaw/skills/code-review-toolkit

# 必选：实例诊断 + 缓存优化
cp -r /tmp/sftgroup-agent/skills/openclaw-instance-doctor ~/.openclaw/skills/openclaw-instance-doctor

# 可选：Git 操作规范
cp -r /tmp/sftgroup-agent/skills/git-operations ~/.openclaw/skills/git-operations

# 清理
rm -rf /tmp/sftgroup-agent
```

### ③ 注册 MCP 工具

编辑 `~/.openclaw/openclaw.json`，加入 `tools.mcpServers`：

```json5
{
  "tools": {
    "mcpServers": {
      // 代码管理（同步、拉取、推送、审计）
      "git": {
        "type": "http",
        "url": "http://43.156.46.187:3082",
        "tools": ["repo_register", "repo_sync", "repo_snapshot", "git_pull", "git_push", "git_status", "git_audit"]
      },
      // 代码审查（15 种 lint 工具，机械检查）
      "code-review": {
        "type": "http",
        "url": "http://43.156.46.187:9001",
        "tools": ["review_all", "review_lint", "review_format", "review_types", "review_complexity", "review_deps"]
      },
      // 安全审计（46 个工具自动编排，3 个入口：contract_audit/centralized_audit/production_audit）
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

---

## 验证

```bash
# 1. 检查 MCP 连接
curl http://43.156.46.187:9001/health        # → {"status":"ok"}
curl http://43.156.46.187:3082/health        # → {"status":"ok","tools":18}

# 2. 注册仓库（以 team1 为例）
# 在 OpenClaw 对话中：

#    调用 git-mcp.repo_register
#    team: "team1"
#    repo_url: "你的 GitHub 仓库地址"

# 3. 同步代码
#    调用 git-mcp.repo_sync
#    team: "team1"
#    代码自动同步到 /opt/mcp/repos/team1/

# 4. 运行审查
#    调用 code-review.review_all
#    project_path: "/opt/mcp/repos/team1"
#    language: "all"
```

---

## AGENTS.md 参考

从 `sftgroup/agent/agents/templates/` 拿模板改：

| 模板 | 角色 | 说明 |
|------|------|------|
| `00-architect.md` | 主 agent | 调度、架构、路由 |
| `01-qa.md` | QA | 含 code-review MCP 集成、三层审查 |
| `02-security.md` | Security | 深度安全审计 |
| `03-security-check-contracts.md` | 合约扫描 | Slither/Aderyn/Echidna |
| `04-security-check-centralized.md` | 中心化扫描 | SAST/DAST/SCA |

QA agent 接入后最显著的变化：**人工审查前先跑 code-review.review_all 把格式/类型/依赖问题全扫一遍，AI 只审逻辑。**

---

## MCP 服务器信息

| 服务 | 地址 | 端口 | 工具数 |
|------|------|:---:|:---:|
| git-mcp | 43.156.46.187 | 3082 | 18 |
| code-review | 43.156.46.187 | 9001 | 6 |
| security-tools | 43.156.46.187 | 3000 | 46 |
| build-mcp | 43.156.46.187 | 3081 | 6 |

> security-tools 使用 SSE 传输，其余 HTTP 直连。全部 systemd 管理，自动重启。

---

## 缓存优化（可选但推荐）

接入 instance-doctor 后运行：

```bash
openclaw gateway stop
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/fix-config.sh
openclaw gateway start

# 验证
bash ~/.openclaw/skills/openclaw-instance-doctor/scripts/diagnose.sh
# → 缓存命中链: 7/7 ✅
```

优化效果：缓存命中率从 ~50% 提升到 **82%**，响应更快、token 更省。

---

## 接入后：清理本地冗余工具

接入 MCP 后，子 agent 不再需要本地装安全工具。**SSH 到每台实例执行以下清理**：

```bash
# 卸载安全扫描工具（MCP 已替代）
pip3 uninstall -y --break-system-packages slither-analyzer mythril bandit semgrep pip-audit 2>/dev/null
sudo rm -f /usr/local/bin/{gitleaks,trivy,nuclei,echidna,aderyn}
sudo apt-get remove -y nmap 2>/dev/null
pip3 cache purge
```

> 保留 eslint、prettier、tsc、solhint、ruff、black、mypy、radon — code-review MCP 审查时在服务器上运行，本地开发可能用到。

**清理效果**：释放约 500MB/实例，AGENTS.md 从 754 行精简到 222 行（-70%）。

---

## 常见问题

**Q: 外网连不上 MCP？**
A: 你的 IP 需加入 43.156.46.187 的安全组白名单，找 stevenwang。

**Q: code-review 返回 "项目路径不在白名单"？**
A: 项目必须在 `/opt/mcp/repos/<team>/` 下。用 git-mcp.repo_sync 同步即可。

**Q: 能装在自己服务器上吗？**
A: 可以。把 `sftgroup/agent/skills/code-review-toolkit/` 复制过去，运行 `scripts/install-linters.sh` 装工具，改 systemd 监听端口即可。

**Q: 工具版本不一致怎么办？**
A: `install-linters.sh` 已锁定所有 15 个工具版本号。两台服务器跑出来结果一样。
