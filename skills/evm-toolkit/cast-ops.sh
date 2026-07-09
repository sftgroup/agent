#!/usr/bin/env bash
# cast-ops.sh — 封装常用 cast 操作，统一 RPC 切换
# 用法: source cast-ops.sh && chain-use eth && cast-balance 0x...
# 或: ./cast-ops.sh balance eth 0x...

set -euo pipefail

# === 链配置 ===
declare -A RPC=(
  [eth]="${ETH_RPC:-}"
  [bsc]="${BSC_RPC:-}"
  [base]="${BASE_RPC:-}"
  [polygon]="${POLYGON_RPC:-}"
  [arb]="${ARB_RPC:-}"
  [sepolia]="${SEPOLIA_RPC:-https://sepolia.infura.io/v3/KEY}"
)

declare -A EXPLORER=(
  [eth]="https://etherscan.io"
  [bsc]="https://bscscan.com"
  [base]="https://basescan.org"
  [polygon]="https://polygonscan.com"
  [arb]="https://arbiscan.io"
)

# === 切换链 ===
chain-use() {
  local c="${1:?用法: chain-use <eth|bsc|base|polygon|arb>}"
  if [ -z "${RPC[$c]:-}" ]; then
    echo "❌ Unknown chain: $c"
    echo "   Known: ${!RPC[*]}"
    return 1
  fi
  export RPC_URL="${RPC[$c]}"
  export CHAIN="$c"
  echo "⛓️  Using $c → $RPC_URL"
}

chain-list() {
  for c in "${!RPC[@]}"; do
    printf "  %-10s %s\n" "$c" "${RPC[$c]}"
  done
}

# === 查询 ===
cast-balance() {
  local addr="${1:?用法: cast-balance <address>}"
  cast balance "$addr" --rpc-url "$RPC_URL" 2>/dev/null
}

cast-erc20-balance() {
  local token="${1:?}" addr="${2:?}"
  cast call "$token" "balanceOf(address)(uint256)" "$addr" --rpc-url "$RPC_URL"
}

cast-erc20-info() {
  local token="${1:?}"
  echo "Name: $(cast call "$token" "name()(string)" --rpc-url "$RPC_URL")"
  echo "Symbol: $(cast call "$token" "symbol()(string)" --rpc-url "$RPC_URL")"
  echo "Decimals: $(cast call "$token" "decimals()(uint8)" --rpc-url "$RPC_URL")"
}

cast-nonce() {
  local addr="${1:?}"
  cast nonce "$addr" --rpc-url "$RPC_URL"
}

cast-tx() {
  local hash="${1:?}"
  cast tx "$hash" --rpc-url "$RPC_URL"
}

cast-code-size() {
  local addr="${1:?}"
  cast code "$addr" --rpc-url "$RPC_URL" | wc -c
}

cast-events() {
  local addr="${1:?}" topic="${2:?}" from="${3:-0}" to="${4:-latest}"
  cast logs --rpc-url "$RPC_URL" --address "$addr" \
    --topic "$topic" --from-block "$from" --to-block "$to"
}

# === ERC20 写入 ===
cast-erc20-approve() {
  local token="${1:?}" spender="${2:?}" amount="${3:?}"
  cast send "$token" "approve(address,uint256)" "$spender" "$amount" --rpc-url "$RPC_URL" --private-key "$PK"
}

cast-erc20-transfer() {
  local token="${1:?}" to="${2:?}" amount="${3:?}"
  cast send "$token" "transfer(address,uint256)" "$to" "$amount" --rpc-url "$RPC_URL" --private-key "$PK"
}

# === Gas ===
cast-gas-check() {
  echo "Current gas: $(cast gas-price --rpc-url "$RPC_URL")"
}

# === Nonce 同步（多链） ===
nonce-sync-check() {
  local addr="${1:?}"
  echo "=== Nonce check ($addr) ==="
  for c in eth bsc base polygon arb; do
    if [ -n "${RPC[$c]:-}" ]; then
      local n
      n=$(cast nonce "$addr" --rpc-url "${RPC[$c]}" 2>/dev/null || echo "ERR")
      printf "  %-10s %s\n" "$c:" "$n"
    fi
  done
}

# === 交互模式 ===
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  CMD="${1:-help}"
  shift 2>/dev/null || true
  case "$CMD" in
    balance) chain-use "${1:?}"; cast-balance "${2:?}" ;;
    erc20-bal) chain-use "${1:?}"; cast-erc20-balance "${2:?}" "${3:?}" ;;
    erc20-info) chain-use "${1:?}"; cast-erc20-info "${2:?}" ;;
    nonce) chain-use "${1:?}"; cast-nonce "${2:?}" ;;
    tx) chain-use "${1:?}"; cast-tx "${2:?}" ;;
    code) chain-use "${1:?}"; cast-code-size "${2:?}" ;;
    events) chain-use "${1:?}"; cast-events "${2:?}" "${3:-}" "${4:-}" ;;
    gas) chain-use "${1:?}"; cast-gas-check ;;
    sync) nonce-sync-check "${1:?}" ;;
    approve) chain-use "${1:?}"; cast-erc20-approve "${2:?}" "${3:?}" "${4:?}" ;;
    transfer) chain-use "${1:?}"; cast-erc20-transfer "${2:?}" "${3:?}" "${4:?}" ;;
    list) chain-list ;;
    *)
      echo "Usage: cast-ops.sh <cmd> <chain> [args...]"
      echo ""
      echo "Commands:"
      echo "  balance  <chain> <addr>            Get native balance"
      echo "  erc20-bal <chain> <token> <addr>   Get ERC20 balance"
      echo "  erc20-info <chain> <token>         Get ERC20 name/symbol/decimals"
      echo "  nonce    <chain> <addr>            Get nonce"
      echo "  tx       <chain> <hash>            Get tx receipt"
      echo "  code     <chain> <addr>            Get deployed code size"
      echo "  events   <chain> <addr> <topic> [from] [to]  Query event logs"
      echo "  gas      <chain>                   Check gas price"
      echo "  sync     <addr>                    Check nonce across all chains"
      echo "  approve  <chain> <token> <spender> <amount>   ERC20 approve"
      echo "  transfer <chain> <token> <to> <amount>        ERC20 transfer"
      echo "  list                              List chains"
      echo ""
      echo "Env vars: PK, ETH_RPC, BSC_RPC, BASE_RPC, POLYGON_RPC, ARB_RPC"
      ;;
  esac
fi
