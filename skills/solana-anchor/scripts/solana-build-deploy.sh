#!/usr/bin/env bash
# solana-build-deploy.sh — 一键编译+升级部署 Solana 合约
# Usage: ./solana-build-deploy.sh [--check] [--deploy]

set -euo pipefail

PROJECT_DIR="${1:-.}"
PROGRAM_ID="${PROGRAM_ID:-}"
DEPLOY_KEYPAIR="${DEPLOY_KEYPAIR:-}"
DEPLOY_NETWORK="${DEPLOY_NETWORK:-mainnet-beta}"

cd "$PROJECT_DIR"

echo "=== Build ==="
echo "Project: $(pwd)"
echo "Network: $DEPLOY_NETWORK"

# Ensure Solana toolchain is on PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Check for edition2024 compatibility
if grep -q 'edition.*=.*"2024"' Cargo.toml 2>/dev/null; then
  RUSTC_VER=$($HOME/.cache/solana/v1.48/rust/bin/rustc --version 2>/dev/null | grep -oP '\d+\.\d+' || echo "unknown")
  if [[ "$RUSTC_VER" < "1.85" ]]; then
    echo "WARNING: SBF rustc $RUSTC_VER doesn't support edition2024!"
    echo "  Fix: change to edition = \"2021\" in Cargo.toml"
    echo "  Or: symlink platform-tools v1.54 → v1.48"
    exit 1
  fi
fi

echo "Building..."
cargo build-sbf --sbf-out-dir target/deploy 2>&1 | tail -20

SO_FILE=$(ls target/deploy/*.so 2>/dev/null | head -1)
if [ -z "$SO_FILE" ]; then
  echo "ERROR: no .so found in target/deploy/"
  exit 1
fi
echo "Build OK: $SO_FILE ($(du -h "$SO_FILE" | cut -f1))"

# Check mode: stop here
[[ "${2:-}" == "--check" ]] && exit 0

# Deploy mode
if [ -z "$PROGRAM_ID" ] || [ -z "$DEPLOY_KEYPAIR" ]; then
  echo ""
  echo "=== Deploy skipped (no PROGRAM_ID/DEPLOY_KEYPAIR) ==="
  echo "To deploy, set env vars:"
  echo "  PROGRAM_ID=xxx DEPLOY_KEYPAIR=/path/to/keypair.json ./solana-build-deploy.sh --deploy"
  exit 0
fi

echo ""
echo "=== Deploy ==="
echo "SO: $SO_FILE"
echo "Program ID: $PROGRAM_ID"
echo "Keypair: $DEPLOY_KEYPAIR"

# Check wallet SOL balance
BALANCE=$(solana balance --keypair "$DEPLOY_KEYPAIR" 2>/dev/null | grep -oP '[\d.]+' || echo "0")
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.05" | bc -l 2>/dev/null || echo 1) )); then
  echo "WARNING: wallet balance may be too low for deploy (need >=0.05 SOL for upgrade)"
fi

read -p "Proceed with upgrade deploy? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deploy cancelled."
  exit 0
fi

solana program deploy "$SO_FILE" \
  --program-id "$PROGRAM_ID" \
  --keypair "$DEPLOY_KEYPAIR" \
  --url "$DEPLOY_NETWORK" \
  2>&1

echo ""
echo "=== Verify ==="
solana program show "$PROGRAM_ID" 2>&1
