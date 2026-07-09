#!/usr/bin/env bash
# Code Review Toolkit — Solidity lint
# Usage: bash lint-solidity.sh <project-root>
set -e

PROJECT="${1:-.}"
SELF_DIR=$(dirname "$0")
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:$PATH"

# Ensure solhint installed
command -v solhint >/dev/null 2>&1 || npm install -g solhint

# Copy config
CFG="$SELF_DIR/../references/.solhint.json"
[ -f "$CFG" ] && cp "$CFG" "$PROJECT/.solhint.json"

# Run
echo "=== solhint ==="
solhint "$PROJECT/contracts/src/**/*.sol" 2>&1

# forge fmt
echo ""
echo "=== forge fmt check ==="
cd "$PROJECT"
forge fmt --check 2>&1
