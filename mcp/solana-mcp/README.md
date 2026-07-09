# Solana MCP Server

Solana contract build & deploy service. See [main README](../../README.md) for full docs.

## Quick start

```bash
pnpm install && pnpm build
mkdir -p ~/.solana-mcp
# edit ~/.solana-mcp/config.json
sudo cp solana-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now solana-mcp
```
