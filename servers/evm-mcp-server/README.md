# EVM MCP Server

Centralized Ethereum-compatible chain operations via MCP protocol.

## Quick Start

```bash
# 1. Install
git clone https://github.com/sftgroup/agent.git
cd agent/skills/evm-toolkit/../../servers/evm-mcp-server
# or standalone:
# git clone https://github.com/sftgroup/evm-mcp-server.git

pnpm install

# 2. Configure
cp .env.example .env
vim .env  # Fill in RPC URLs, PRIVATE_KEY, explorer API keys

# 3. Run (stdio mode for local dev)
npx tsx src/server.ts

# 4. Or Docker
docker build -t evm-mcp .
docker run -d --name evm-mcp -p 8199:8199 \
  -v /path/to/.env:/app/.env \
  -v /path/to/state.db:/data/evm-mcp/state.db \
  evm-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `evm_status` | Chain status: block, gas, balance, nonce |
| `evm_call` | Read-only contract call |
| `evm_send` | Send transaction |
| `evm_deploy` | Compile + deploy + verify |
| `evm_verify` | Verify contract on explorer |
| `evm_logs` | Query event logs |
| `evm_token` | ERC20 balance/transfer/approve/allowance |
| `evm_gas_preset` | Recommended gas settings |
| `evm_registry` | Query deployment history |

## OpenClaw Configuration

```json
{
  "mcp": {
    "servers": {
      "evm-build": {
        "command": "npx",
        "args": ["tsx", "/path/to/evm-mcp-server/src/server.ts"],
        "env": {
          "ETH_RPC": "...",
          "PRIVATE_KEY": "..."
        }
      }
    }
  }
}
```

## State Database

SQLite at `state.db`:
- `nonces` — per-chain deployer nonce tracking
- `deployments` — full deployment history with tags
- `tx_queue` — pending/confirmed/failed transaction tracking
