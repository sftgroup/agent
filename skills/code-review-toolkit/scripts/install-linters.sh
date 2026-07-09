#!/usr/bin/env bash
# Code Review Toolkit — install all linters on MCP server (idempotent)
# Usage: bash install-linters.sh
# Designed for MCP server (43.156.46.187). Portable to any server.
set -e

echo "=== Code Review Toolkit — Linter Install ==="
echo "Server: $(hostname) | $(date -Iseconds)"
echo ""

# --- Node.js (if missing) ---
if ! command -v node >/dev/null 2>&1; then
  echo "--- Installing Node.js 22 ---"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "node: $(node --version)"
echo "npm:  $(npm --version)"

# --- JS/TS tools ---
echo ""
echo "--- JS/TS Linters ---"
for pkg in eslint prettier typescript; do
  if npm list -g "$pkg" 2>/dev/null | grep -q "$pkg"; then
    echo "✅ $pkg already installed"
  else
    echo "📦 installing $pkg..."
    npm install -g "$pkg"
    echo "✅ $pkg installed"
  fi
done

# --- Solidity ---
echo ""
echo "--- Solidity Linters ---"
if npm list -g solhint 2>/dev/null | grep -q solhint; then
  echo "✅ solhint already installed"
else
  echo "📦 installing solhint..."
  npm install -g solhint
  echo "✅ solhint installed"
fi

# --- Python tools ---
echo ""
echo "--- Python Linters ---"
for pkg in ruff black mypy radon pip-audit; do
  if pip3 list 2>/dev/null | grep -qi "^$pkg "; then
    echo "✅ $pkg already installed"
  else
    echo "📦 installing $pkg..."
    pip3 install --break-system-packages "$pkg" 2>/dev/null
    echo "✅ $pkg installed"
  fi
done

# --- Shell ---
echo ""
echo "--- Shell Linters ---"
if command -v shellcheck >/dev/null 2>&1; then
  echo "✅ shellcheck already installed"
else
  echo "📦 installing shellcheck (apt)..."
  sudo apt-get install -y shellcheck 2>/dev/null && echo "✅ shellcheck installed" || echo "⚠️  shellcheck not installable"
fi

if command -v shfmt >/dev/null 2>&1; then
  echo "✅ shfmt already installed"
else
  echo "📦 installing shfmt (via snap)..."
  sudo snap install shfmt 2>/dev/null && echo "✅ shfmt installed" || echo "⚠️  shfmt not installed (optional)"
fi

# --- Foundry (forge fmt) ---
echo ""
echo "--- Foundry ---"
if command -v forge >/dev/null 2>&1; then
  echo "✅ forge: $(forge --version)"
else
  echo "📦 installing foundry..."
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup 2>/dev/null && echo "✅ foundry installed" || echo "⚠️  foundry install failed (non-critical)"
fi

# --- sshpass (SSH operations) ---
echo ""
echo "--- SSH ---"
if command -v sshpass >/dev/null 2>&1; then
  echo "✅ sshpass already installed"
else
  echo "📦 installing sshpass..."
  sudo apt-get install -y sshpass
  echo "✅ sshpass installed"
fi

# --- Status ---
echo ""
echo "=== Final Status ==="
for t in node eslint prettier tsc solhint ruff black mypy radon pip-audit shellcheck shfmt forge sshpass; do
  if command -v "$t" >/dev/null 2>&1; then
    ver=$($t --version 2>&1 | head -1 | tr '\n' ' ')
    echo "✅ $t: $ver"
  else
    echo "❌ $t: MISSING"
  fi
done

echo ""
echo "=== Install Complete ==="
