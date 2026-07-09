#!/usr/bin/env bash
# Code Review Toolkit — install all linters (idempotent)
# Usage: bash install-linters.sh
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:/usr/local/bin:$HOME/go/bin:$PATH"

echo "=== Installing Linters ==="

# JS/TS
echo "--- JS/TS ---"
npm list -g eslint 2>/dev/null | grep -q eslint && echo "✅ eslint already" || { npm install -g eslint && echo "✅ eslint installed"; }
npm list -g prettier 2>/dev/null | grep -q prettier && echo "✅ prettier already" || { npm install -g prettier && echo "✅ prettier installed"; }
command -v tsc >/dev/null 2>&1 && echo "✅ tsc available" || { npm install -g typescript && echo "✅ typescript installed"; }

# Solidity
echo "--- Solidity ---"
npm list -g solhint 2>/dev/null | grep -q solhint && echo "✅ solhint already" || { npm install -g solhint && echo "✅ solhint installed"; }

# Python
echo "--- Python ---"
pip3 list 2>/dev/null | grep -qi "^ruff " && echo "✅ ruff already" || { pip3 install --break-system-packages ruff 2>/dev/null && echo "✅ ruff installed"; }
pip3 list 2>/dev/null | grep -qi "^black " && echo "✅ black already" || { pip3 install --break-system-packages black 2>/dev/null && echo "✅ black installed"; }
pip3 list 2>/dev/null | grep -qi "^mypy " && echo "✅ mypy already" || { pip3 install --break-system-packages mypy 2>/dev/null && echo "✅ mypy installed"; }
pip3 list 2>/dev/null | grep -qi "^radon " && echo "✅ radon already" || { pip3 install --break-system-packages radon 2>/dev/null && echo "✅ radon installed"; }
pip3 list 2>/dev/null | grep -qi "^pip-audit " && echo "✅ pip-audit already" || { pip3 install --break-system-packages pip-audit 2>/dev/null && echo "✅ pip-audit installed"; }

# Shell
echo "--- Shell ---"
command -v shellcheck >/dev/null 2>&1 && echo "✅ shellcheck available" || { sudo apt-get install -y shellcheck 2>/dev/null && echo "✅ shellcheck installed" || echo "⚠️  shellcheck not installable"; }
command -v shfmt >/dev/null 2>&1 && echo "✅ shfmt available" || { sudo apt-get install -y shfmt 2>/dev/null || echo "⚠️  shfmt not installable"; }

echo ""
echo "=== Linter Status ==="
for t in eslint prettier solhint ruff black mypy radon shellcheck; do
  command -v "$t" >/dev/null 2>&1 && echo "✅ $t: $($t --version 2>&1 | head -1)" || echo "❌ $t MISSING"
done
