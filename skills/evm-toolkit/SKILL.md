---
name: evm-toolkit
description: "EVM multichain ops — cast/hardhat for Ethereum, BSC, Polygon, Arbitrum, Base. ERC20, contract deploy/call, event logs, EIP-1559 gas."
metadata: {"clawdbot":{"emoji":"⛓️","requires":{"commands":["cast","forge","npx"]},"homepage":"https://github.com/sftgroup/contra-agent-skills"}}
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

## Hardhat config (multi-chain template)

```js
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" }},
  networks: {
    bsc:  { url: process.env.BSC_RPC || "",  chainId: 56,    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
    eth:  { url: process.env.ETH_RPC || "",  chainId: 1,     accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
    base: { url: process.env.BASE_RPC || "", chainId: 8453,  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
    polygon: { url: process.env.POLYGON_RPC || "", chainId: 137, accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
    arbitrum: { url: process.env.ARB_RPC || "", chainId: 42161, accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },
  }
};
```

## Deploy script pattern

```js
const [deployer] = await hre.ethers.getSigners();
const Factory = await hre.ethers.getContractFactory("ContractName");
const c = await Factory.deploy(...args, { gasLimit: 3000000 });
await c.deployed();
```

Run: `npx hardhat run scripts/deploy.js --network bsc`

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
cast send $TOKEN "approve(address,uint256)" $SPENDER $AMOUNT --rpc-url $RPC --private-key $PK
cast send $TOKEN "transfer(address,uint256)" $TO $AMOUNT --rpc-url $RPC --private-key $PK

# Contract calls
cast send $CONTRACT "mint()" --value 0.1ether --rpc-url $RPC --private-key $PK
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
# Submit manually on explorer
```

## Gas strategy

| Chain | maxFeePerGas | maxPriorityFeePerGas |
|-------|-------------|---------------------|
| ETH | 50-100 gwei | 2 gwei |
| BSC | 3 gwei | 1 gwei |
| Base | 0.01 gwei | 0.001 gwei |
| Polygon | 30-100 gwei | 30 gwei |

Stuck tx: replace with same nonce + higher gas.

## Pitfalls (from Contra AI mainnet)

1. Public RPC `eth_getLogs` throttled → use commercial RPC
2. Nonce mismatch across chains → sync before deploy
3. EstimateGas fails when state unsatisfied → manual calldata + gasLimit
4. EIP-712 fails → check type name matches `_TYPEHASH`, BigInt→String()
5. OZ v5 domain: no `salt`/`extensions` in separator
6. BSC tx stuck → bump gas or replace-same-nonce
7. Never `hre.changeNetwork()` — run separate `npx hardhat run --network <x>`
8. `.env` leaked to git → `.gitignore` check before commit
9. Deploy records lost → auto-write `DEPLOY_RECORDS.md` in script

See `references/pitfalls.md` for detailed Contra AI war stories.

## Bundled Scripts & Templates

### scripts/

- `scripts/deploy-multichain.js` — Hardhat multi-chain deploy, reads `contracts-config.json`, auto-writes `DEPLOY_RECORDS.md`
- `scripts/cast-ops.sh` — Wrapped cast operations: `cast-ops.sh balance eth 0x...`, `cast-ops.sh sync 0x...` for cross-chain nonce check

### assets/

- `assets/hardhat.config.js` — Drop-in multi-chain template with eth/bsc/base/polygon/arb/sepolia
- `assets/.env.template` — RPC + private key + explorer API key template

### Usage

```bash
# Quick query
source scripts/cast-ops.sh
chain-use bsc
cast-balance 0x...
cast-erc20-info 0xTOKEN

# Cross-chain nonce sync (pre-deploy check)
scripts/cast-ops.sh sync 0xDEPLOYER

# Deploy
cp assets/hardhat.config.js contracts/
cp assets/.env.template .env
# edit .env with real keys
npx hardhat run scripts/deploy-multichain.js --network bsc
```
