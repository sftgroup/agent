#!/usr/bin/env bash
# solana-verify-state.sh — 读取链上合约状态
# Usage: PROGRAM_ID=<id> ./solana-verify-state.sh

set -euo pipefail

PROGRAM_ID="${PROGRAM_ID:-}"
RPC_URL="${RPC_URL:-https://api.mainnet-beta.solana.com}"

if [ -z "$PROGRAM_ID" ]; then
  echo "Usage: PROGRAM_ID=<id> ./solana-verify-state.sh"
  exit 1
fi

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "=== Program Info ==="
solana program show "$PROGRAM_ID" --url "$RPC_URL"

echo ""
echo "=== State PDA ==="
# Adjust seed name for your contract
SEED="${STATE_SEED:-state}"
STATE_PDA=$(solana find-program-derived-address "$SEED" "$PROGRAM_ID" 2>/dev/null | head -1 | awk '{print $NF}') || \
    STATE_PDA=$(node -e "
      const {PublicKey} = require('@solana/web3.js');
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from('$SEED')], new PublicKey('$PROGRAM_ID'));
      console.log(pda.toString());
    " 2>/dev/null)

if [ -n "$STATE_PDA" ]; then
  echo "PDA: $STATE_PDA"
  echo ""
  echo "=== State Data (hex) ==="
  solana account "$STATE_PDA" --url "$RPC_URL" 2>&1 | head -30
else
  echo "Could not derive state PDA."
fi
