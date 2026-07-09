# Build MCP Server

Universal build service for npm/docker/mobile. See [main README](../../README.md) for full docs.

## Quick start

```bash
pnpm install && pnpm build
mkdir -p ~/.build-mcp
# edit ~/.build-mcp/config.json
sudo cp build-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now build-mcp
```
