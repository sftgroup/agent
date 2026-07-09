#!/usr/bin/env bash
# Code Review Toolkit — JS/TS lint + typecheck + format
# Usage: bash lint-typescript.sh <project-root>
set -e

PROJECT="${1:-.}"
SELF_DIR=$(dirname "$0")
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:$PATH"

# Ensure deps
for pkg in eslint prettier typescript; do
  command -v "$pkg" >/dev/null 2>&1 || npm install -g "$pkg"
done

# ESLint config
CFG="$SELF_DIR/../references/.eslintrc.json"
[ -f "$CFG" ] && cp "$CFG" "$PROJECT/.eslintrc.json"

echo "=== eslint ==="
cd "$PROJECT"
npx eslint . --ext .ts,.tsx,.js,.jsx --ignore-pattern node_modules --ignore-pattern dist --ignore-pattern build 2>&1

echo ""
echo "=== tsc --noEmit ==="
[ -f tsconfig.json ] && npx tsc --noEmit 2>&1 || echo "(no tsconfig.json, skipping)"

echo ""
echo "=== prettier ==="
npx prettier --check "**/*.{ts,tsx,js,jsx}" --ignore-path .gitignore 2>/dev/null || echo "format issues found"
