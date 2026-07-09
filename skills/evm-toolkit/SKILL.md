---
name: evm-toolkit
description: "EVM multichain ops — cast/hardhat for Ethereum, BSC, Polygon, Arbitrum, Base. ERC20, contract deploy/call, event logs, EIP-1559 gas."
metadata: {"clawdbot":{"emoji":"⛓️","requires":{"commands":["cast","forge","npx"]},"homepage":"https://github.com/sftgroup/agent"}}
---

# EVM Toolkit

Multichain ops distilled from Contra AI 4-chain (BSC/ETH/Base) mainnet deployment experience.

## Chain IDs

| Chain | ID | Explorer | Symbol |
|-------|----|----------|--------|
| Ethereum | 1 | etherscan.io | ETH |
| BSC | 56 | bscscan.com | BNB |
| Polygon | 137 | polygonscan.com | POL |
| Arbitrum | 42161 | arbiscan.io | ETH |
| Base | 8453 | basescan.org | ETH |
| Optimism | 10 | optimism.etherscan.io | ETH |
| Avalanche C | 43114 | snowtrace.io | AVAX |
| Sepolia | 11155111 | sepolia.etherscan.io | ETH |

## Rules

- Use commercial RPC (Infura/Alchemy/QuickNode) — public RPC `eth_getLogs` throttled hard
- Verify nonce across all chains before multi-chain deploy
- Test cheapest chain first (BSC/Polygon) then expand
- Single config source (`contracts-config.json`) for all addresses/RPC/chainId
- Write deploy record after every deploy (contract address + tx hash)
- `.env` in `.gitignore` always
- Use EIP-1559 (Type 2) for mainnet

## Bundled scripts

- `scripts/deploy-multichain.js` — Hardhat multi-chain deploy, reads `contracts-config.json`, auto-writes `DEPLOY_RECORDS.md`. Run: `npx hardhat run scripts/deploy-multichain.js --network bsc`
- `scripts/cast-ops.sh` — Wrapped cast: `cast-ops.sh balance eth 0x...`, `cast-ops.sh sync 0x...` for cross-chain nonce check
- `assets/hardhat.config.js` — Drop-in 6-chain template (eth/bsc/base/polygon/arb/sepolia)
- `assets/.env.template` — RPC + PK + explorer API key template

## cast quick reference

```bash
# Query
cast balance $ADDR --rpc-url $RPC
cast call $TOKEN "balanceOf(address)(uint256)" $ADDR --rpc-url $RPC
cast call $TOKEN "decimals()(uint8)" --rpc-url $RPC
cast call $CONTRACT "owner()(address)" --rpc-url $RPC
cast nonce $ADDR --rpc-url $RPC
cast tx $TXHASH --rpc-url $RPC
cast code $CONTRACT --rpc-url $RPC | wc -c

# ERC20
cast call $TOKEN "allowance(address,address)(uint256)" $OWNER $SPENDER --rpc-url $RPC
cast send $TOKEN "approve(address,uint256)" $SPENDER $AMOUNT --rpc-url $RPC --private-key ***
cast send $TOKEN "transfer(address,uint256)" $TO $AMOUNT --rpc-url $RPC --private-key ***

# Contract calls
cast send $CONTRACT "mint()" --value 0.1ether --rpc-url $RPC --private-key ***
cast send $CONTRACT "mint()" --gas-limit 300000 --max-fee-per-gas 50gwei --max-priority-fee-per-gas 2gwei --rpc-url $RPC --pk $PK

# Event logs
cast logs --rpc-url $RPC --address $TOKEN --topic $TRANSFER_SIG --from-block $N --to-block $M

# Gas
cast gas-price --rpc-url $RPC
cast base-fee --rpc-url $RPC
```

## EIP-712 signing (OZ v5 compatible)

```js
const domain = { name: "Protocol", version: "1", chainId: 1, verifyingContract: addr };
const types = { Action: [
  { name: "user", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
]};
const sig = await signer.signTypedData(domain, types, value);
// ⚠️ BigInt must be String()-serialized
// ⚠️ Type name must match contract _TYPEHASH
// ⚠️ OZ v5.6 domain separator is standard 4-field (no salt/extensions)
```

## Deterministic multi-chain deploy

Same bytecode + same deployer nonce = same address across chains.

```bash
cast nonce $DEPLOYER --rpc-url $ETH_RPC
cast nonce $DEPLOYER --rpc-url $BSC_RPC
cast nonce $DEPLOYER --rpc-url $BASE_RPC
# Ensure all equal. If not → send zero-value tx to catch up.
# Deploy in gas-ascending order: BSC → Polygon → Base → Arbitrum → ETH
```

## Contract verification

```bash
npx hardhat verify --network eth $ADDR $ARG1 $ARG2
# Multi-file: flatten first
npx hardhat flatten src/Contract.sol > flat.sol
```

## Gas strategy

| Chain | maxFeePerGas | maxPriorityFeePerGas |
|-------|-------------|---------------------|
| ETH | 50-100 gwei | 2 gwei |
| BSC | 3 gwei | 1 gwei |
| Base | 0.01 gwei | 0.001 gwei |
| Polygon | 30-100 gwei | 30 gwei |

Stuck tx: replace with same nonce + higher gas.

## MCP Server (centralized execution)

For centralized private-key management and nonce locking across multiple OpenClaw instances, use `evm-mcp-server`:

```
https://github.com/sftgroup/agent/tree/master/servers/evm-mcp-server
```

Tools: `evm_status`, `evm_call`, `evm_send`, `evm_deploy`, `evm_verify`, `evm_logs`, `evm_token`, `evm_gas_preset`, `evm_registry`.

## Pitfalls

| # | Problem | Root cause | Fix |
|---|---------|------------|-----|
| 1 | `eth_getLogs` 429 | Public RPC throttled | Commercial RPC (Infura/Alchemy) |
| 2 | Nonce mismatch across chains | Extra tx on one chain | Sync nonce before deploy |
| 3 | Contract address differs | Nonce ≠ → CREATE address ≠ | Re-deploy after nonce sync |
| 4 | estimateGas reverts | State unsatisfied (allowance etc.) | Manual calldata + fixed gasLimit |
| 5 | EIP-712 signature rejected | Type name/field mismatch | Match contract `_TYPEHASH` exactly |
| 6 | OZ v5 domain mismatch | Extra salt/extensions in domain | Use standard 4-field domain only |
| 7 | BSC tx pending forever | Gas too low | Bump gas or replace-same-nonce |
| 8 | Hardhat crash on chain switch | `hre.changeNetwork()` unreliable | Separate `npx hardhat run --network <x>` |
| 9 | `.env` leaked to git | Missing `.gitignore` | `git status` before commit |
| 10 | Deploy records lost | No auto-logging | `deploy-multichain.js` writes `DEPLOY_RECORDS.md` |

See `references/pitfalls.md` for detailed Contra AI war stories.
