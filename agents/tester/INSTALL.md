# Autotest MCP — 安装指引

给其他 OpenClaw 实例接入自动化测试能力的完整步骤。

---

## 架构

```
你的 OpenClaw 实例                     MCP 测试服务器
┌──────────────────┐                  ┌──────────────────────────────┐
│  tester agent    │  MCP SSE ────→  │  autotest-web3  :8081        │
│  (AGENTS.md)     │                  │  ├─ forge / cast / solana    │
│                  │                  │  └─ slither / echidna        │
│  autotest-mcp    │  MCP SSE ────→  │                              │
│  skill           │                  │  autotest-web   :8082        │
│                  │                  │  ├─ playwright / hurl        │
└──────────────────┘                  │  ├─ lighthouse / backstopjs  │
                                      │  └─ trivy / sqlfluff         │
                                      │                              │
                                      │  autotest-dapp  :8083        │
                                      │  ├─ 链上操作 (forge/cast)    │
                                      │  └─ 前端验证 (playwright)    │
                                      └──────────────────────────────┘
```

**一台 MCP 服务器，多台 OpenClaw 实例共享。** OpenClaw 实例不需要安装任何测试工具。

---

## 步骤 1：部署 MCP 服务器（只需一次）

> 如果你已经有 MCP 服务器在运行，跳到步骤 2。

### 1.1 准备服务器

- Ubuntu 22.04+ / 24.04
- 4C8G+ 推荐
- 安全组开放 8081-8083 端口（TCP）

### 1.2 上传代码

```bash
# 在 MCP 服务器上
git clone https://github.com/sftgroup/autotest-mcp.git /home/ubuntu/workspace/autotest-mcp
cd /home/ubuntu/workspace/autotest-mcp
```

### 1.3 安装依赖

```bash
# 三个服务依次安装
bash autotest-web3/install.sh   # forge / cast / solana / slither
bash autotest-web/install.sh    # playwright / hurl / lighthouse / trivy
bash autotest-dapp/install.sh   # DApp 混合依赖
```

### 1.4 配置环境变量

```bash
# web3
cp autotest-web3/.env.example autotest-web3/.env
vim autotest-web3/.env
# 必填: ETH_RPC, DEPLOYER_PRIVATE_KEY, SOLANA_RPC

# web
cp autotest-web/.env.example autotest-web/.env
vim autotest-web/.env
# 必填: FRONTEND_URL, API_BASE

# dapp
cp autotest-dapp/.env.example autotest-dapp/.env
vim autotest-dapp/.env
# 必填: ETH_RPC, DEPLOYER_PRIVATE_KEY, SOLANA_RPC, FRONTEND_URL
```

### 1.5 启动服务

```bash
# 注册 systemd 服务
sudo cp autotest-web3/autotest-web3.service /etc/systemd/system/
sudo cp autotest-web/autotest-web.service /etc/systemd/system/
sudo cp autotest-dapp/autotest-dapp.service /etc/systemd/system/

# 给 systemd 加上环境 PATH（让 forge/node 等可用）
for svc in autotest-web3 autotest-web autotest-dapp; do
    sudo sed -i '/^\[Service\]/a Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/ubuntu/.foundry/bin:/home/ubuntu/.local/bin' /etc/systemd/system/$svc.service
done

sudo systemctl daemon-reload
sudo systemctl enable --now autotest-web3 autotest-web autotest-dapp

# 验证
ss -tlnp | grep -E '808[123]'   # 应看到三个 LISTEN
```

### 1.6 开放安全组

在云控制台安全组中放行 **TCP 8081-8083**，来源设为你的 OpenClaw 实例 IP（或 0.0.0.0/0）。

---

## 步骤 2：接入 OpenClaw（每台实例执行一次）

### 2.1 添加 MCP 服务器

```bash
# 方式 A: 用脚本（推荐）
MCP_IP=43.156.46.187 bash setup-openclaw.sh

# 方式 B: 手动
openclaw mcp add autotest-web3 --transport sse --url "http://{MCP_IP}:8081/sse" --timeout 300 --no-probe
openclaw mcp add autotest-web  --transport sse --url "http://{MCP_IP}:8082/sse" --timeout 300 --no-probe
openclaw mcp add autotest-dapp --transport sse --url "http://{MCP_IP}:8083/sse" --timeout 300 --no-probe
```

### 2.2 安装 Skill

```bash
# 从 GitHub 安装
openclaw skill install https://github.com/sftgroup/agent/blob/master/agents/tester/autotest-mcp-skill.md

# 或手动复制 skill 文件到 ~/.openclaw/workspace/skills/autotest-mcp/
```

### 2.3 配置 Agent 权限

编辑 `~/.openclaw/openclaw.json`，在 `agents` 段中给 tester agent 启用 MCP 工具：

```json
{
  "agents": {
    "tester": {
      "mcpServers": ["autotest-web3", "autotest-web", "autotest-dapp"]
    }
  }
}
```

重启 OpenClaw Gateway 生效。

### 2.4 验证

向 tester agent 发送：

```
evm_balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

应返回该地址在 Sepolia 上的余额。

---

## 步骤 3：使用

### tester agent 工作流

```
收到任务 "测试项目 /path/to/project"
  → 读取 TEST_SCENARIOS_CT.md / _AT.md / _FT.md
  → 调 MCP Tool 执行测试
  → 写报告到 {项目}/test-reports/E2E_TEST_REPORT.md
```

### 常用 Tool 速查

| 想做什么 | 用哪个 Tool |
|---------|------------|
| 编译 + 跑合约测试 | `evm_contract_test(dir)` |
| 发交易 + 验证结果 | `evm_tx_and_verify(addr, sig, args)` |
| 部署合约 | `evm_deploy_and_verify(dir, script)` |
| 安全审计 | `security_audit(dir)` |
| Solana 测试 | `sol_deploy_and_test(dir)` |
| 打开页面 + 断言 | `browser_page_check(url, expect_text)` |
| 多步用户操作 | `browser_user_flow(url, steps)` |
| API 端到端测试 | `api_e2e_test(hurl_content)` |
| API 压力测试 | `api_load_test(url, connections, duration)` |
| 截图对比 | `visual_regression(url, name)` |
| DApp 全链路 | `dapp_swap_flow` / `dapp_tx_and_ui_check` |

完整工具列表见 [AGENTS.md](./AGENTS.md)

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | tester agent 行为规范（放 `~/.openclaw/workspace/tester/`） |
| `setup-openclaw.sh` | OpenClaw 实例接入脚本 |
| `autotest-mcp-skill.md` | OpenClaw Skill 定义（装到 `~/.openclaw/workspace/skills/`） |

---

## 故障排查

| 现象 | 检查 |
|------|------|
| Tool 调不通 | MCP 服务器端口是否开放？`curl http://{IP}:8081/sse` |
| Tool 返回 error | 服务器上 `systemctl status autotest-*` 看日志 |
| 工具 not found | 服务器上跑对应 `install.sh` 补装依赖 |
| 速率限制 | 等 30 秒自动恢复 |
