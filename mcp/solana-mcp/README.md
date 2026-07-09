# Solana MCP Server

独立 Solana 编译部署 MCP 服务，供多台 OpenClaw agent 远程调用。

## Tools

| Tool | 输入 | 说明 |
|------|------|------|
| `solana_build` | `projectDir`, `edition?` | 编译 SBF .so |
| `solana_deploy` | `soPath`, `programId`, `keypairName?` | 升级部署 |
| `solana_read_state` | `programId`, `seed?` | 读链上 PDA 状态 |
| `solana_verify_tx` | `signature` | 确认交易 |
| `solana_balance` | `address?` | 查余额 |
| `solana_history` | `programId?`, `limit?` | 操作历史 |

## Deploy

```bash
pnpm install && pnpm build
sudo cp solana-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now solana-mcp
```

## Config

放在 `~/.solana-mcp/config.json`:

```json
{
  "port": 3080,
  "host": "127.0.0.1",
  "rpcUrl": "https://api.mainnet-beta.solana.com",
  "keypairs": {
    "default": "/home/ubuntu/.config/solana/id.json",
    "contra": "/tmp/contra-keypair.json"
  },
  "projects": {
    "contra-ai": "/home/ubuntu/contra-ai-solana"
  }
}
```
