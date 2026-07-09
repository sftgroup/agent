# Solana Anchor — 合约开发工具链

> Skill（知识库）+ MCP（编译部署服务）双层架构

---

## 这是什么

Solana 合约开发的完整工具链：

- **Skill** — 教 agent 怎么写 Solana 合约（PDA 设计、SPL Token 支付、Anchor 验证、Bug 排查）
- **solana-mcp** — 帮 agent 编译和部署合约（集中管理 keypair，不需要每台机器配工具链）

---

## 文件结构

```
skills/solana-anchor/
├── SKILL.md                            # Skill 主文档
├── scripts/
│   ├── solana-install.sh               # 自动安装 Solana CLI 2.3.3
│   ├── solana-build-deploy.sh          # 一键编译部署
│   └── solana-verify-state.sh          # 读链上 PDA 状态
└── templates/
    ├── anchor-lib.rs                   # Anchor 合约骨架
    └── client.ts                       # TypeScript 客户端模板

mcp/solana-mcp/
├── src/
│   ├── server.ts                       # Express HTTP 服务器
│   ├── config.ts                       # 配置管理
│   └── tools/
│       ├── build.ts                    # 编译 SBF .so
│       ├── deploy.ts                   # 部署/升级合约
│       ├── readState.ts                # 读链上 PDA 状态
│       ├── verifyTx.ts                 # 交易确认
│       ├── balance.ts                  # SOL/SPL 余额查询
│       └── history.ts                  # 操作历史审计
├── package.json
├── tsconfig.json
└── solana-mcp.service                  # systemd 配置
```

---

## Skill 内容

| 章节 | 内容 |
|------|------|
| 工具链兼容性 | SBF rustc 版本对照表，edition2024 踩坑修复 |
| PDA 设计 | 单例 State PDA + 多例 Per-token PDA |
| Account 结构 | 定长 `[u8; N]` 推荐，Anchor `#[derive(InitSpace)]` |
| Timelock | 24h 三步模式：initiate → cancel → execute |
| SPL Token 支付 | 两跳转账：payer → treasury PDA → beneficiary |
| Anchor 验证 | `#[derive(Accounts)]` + 约束宏标准写法 |
| Bug 库 | 6 类速查 + 4 个实战案例（invoke_signed signer 错、缺少 rent sysvar 等） |
| 编译部署 | MCP tool 调用指南 + 本地 CLI 参考 |
| 安全清单 | 15 项部署前检查 |

---

## MCP 工具

| 工具 | 干什么 | 示例 |
|------|--------|------|
| `solana_build` | 编译 .so | `solana_build(projectName="contra-ai", edition="2021")` |
| `solana_deploy` | 部署/升级 | `solana_deploy(soPath="...", programId="Gw8r...", keypairName="default")` |
| `solana_read_state` | 读 PDA | `solana_read_state(programId="Gw8r...", seed="contra_state")` |
| `solana_verify_tx` | 确认交易 | `solana_verify_tx(signature="...")` |
| `solana_balance` | 余额查询 | `solana_balance(address="HMnQ...")` |
| `solana_history` | 操作日志 | `solana_history(limit=20)` |

---

## 部署

```bash
cd mcp/solana-mcp
pnpm install && pnpm build

mkdir -p ~/.solana-mcp
cat > ~/.solana-mcp/config.json << 'EOF'
{
  "port": 3080, "host": "127.0.0.1",
  "rpcUrl": "https://api.mainnet-beta.solana.com",
  "keypairs": { "default": "/home/ubuntu/.config/solana/id.json" },
  "projects": { "contra-ai": "/home/ubuntu/contra-ai-solana" }
}
EOF

sudo cp solana-mcp.service /etc/systemd/system/
sudo systemctl enable --now solana-mcp
curl http://127.0.0.1:3080/health
```

**前置要求：** Node.js 22+、pnpm、Solana CLI 2.x

---

## Skill 安装

```bash
openclaw skills install git:sftgroup/agent@master#skills/solana-anchor --as solana-anchor
```
