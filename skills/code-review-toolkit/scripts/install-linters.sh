#!/usr/bin/env bash
# Code Review Toolkit — install all linters on MCP server (idempotent, version-locked)
# Usage: bash install-linters.sh
# Version lock: all tools pinned to specific versions for reproducibility.
#   Do NOT remove version pins. If upgrading, update the table in SKILL.md too.
set -e

echo "=== Code Review Toolkit — Linter Install (version-locked) ==="
echo "Server: $(hostname) | $(date -Iseconds)"
echo ""

# ═══ Version Lock Table ═══
# Change these ONLY when intentionally upgrading.
readonly ESLINT_VER="10.6.0"
readonly PRETTIER_VER="3.9.5"
readonly TYPESCRIPT_VER="7.0.2"
readonly SOLHINT_VER="6.2.3"
readonly RUFF_VER="0.15.20"
readonly BLACK_VER="26.5.1"
readonly MYPY_VER="2.2.0"
readonly RADON_VER="6.0.1"
readonly PIPAUDIT_VER="2.10.1"
readonly SHELLCHECK_VER="0.9.0"       # apt package version
readonly SHFMT_VER="3.12.0"            # snap package version
readonly FORGE_CHANNEL="stable"        # foundry channel
readonly NODE_VER="22"
# ═══ End Version Lock ═══

# --- Node.js (if missing) ---
if ! command -v node >/dev/null 2>&1; then
  echo "--- Installing Node.js ${NODE_VER} ---"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VER}.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "node: $(node --version)"
echo "npm:  $(npm --version)"

# --- npm global prefix (avoid sudo) ---
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global 2>/dev/null || true
export PATH="$HOME/.npm-global/bin:$PATH"

# --- JS/TS tools (version-locked) ---
echo ""
echo "--- JS/TS Linters (version-locked) ---"

install_npm() {
  local pkg=$1 ver=$2
  local installed=$(npm list -g "$pkg" 2>/dev/null | grep "$pkg@" | head -1 | grep -oP '\d+\.\d+\.\d+')
  if [ "$installed" = "$ver" ]; then
    echo "✅ $pkg@$ver (correct)"
  else
    echo "📦 installing $pkg@$ver..."
    npm install -g "$pkg@$ver"
    echo "✅ $pkg@$ver installed"
  fi
}

install_npm "eslint" "$ESLINT_VER"
install_npm "prettier" "$PRETTIER_VER"
install_npm "typescript" "$TYPESCRIPT_VER"
install_npm "solhint" "$SOLHINT_VER"

# --- Python tools (version-locked) ---
echo ""
echo "--- Python Linters (version-locked) ---"

export PATH="$HOME/.local/bin:$PATH"

install_pip() {
  local pkg=$1 ver=$2
  local installed=$(pip3 list 2>/dev/null | grep -i "^$pkg " | awk '{print $2}')
  if [ "$installed" = "$ver" ]; then
    echo "✅ $pkg==$ver (correct)"
  else
    echo "📦 installing $pkg==$ver..."
    pip3 install --break-system-packages "$pkg==$ver" 2>/dev/null
    echo "✅ $pkg==$ver installed"
  fi
}

install_pip "ruff" "$RUFF_VER"
install_pip "black" "$BLACK_VER"
install_pip "mypy" "$MYPY_VER"
install_pip "radon" "$RADON_VER"
install_pip "pip-audit" "$PIPAUDIT_VER"

# --- Shell tools ---
echo ""
echo "--- Shell Linters ---"
if command -v shellcheck >/dev/null 2>&1; then
  echo "✅ shellcheck"
else
  sudo apt-get install -y shellcheck
fi

if command -v shfmt >/dev/null 2>&1; then
  echo "✅ shfmt"
else
  sudo snap install shfmt 2>/dev/null || echo "⚠️ shfmt not installed (optional)"
fi

# --- Foundry ---
echo ""
echo "--- Foundry ---"
if command -v forge >/dev/null 2>&1; then
  echo "✅ forge: $(forge --version 2>&1 | head -1)"
else
  echo "📦 installing foundry ($FORGE_CHANNEL)..."
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup 2>/dev/null && echo "✅ foundry installed" || echo "⚠️ foundry install failed"
fi

# --- sshpass ---
if ! command -v sshpass >/dev/null 2>&1; then
  sudo apt-get install -y sshpass
fi

# --- Final Status ---
echo ""
echo "=== Final Status (all versions should match lock table) ==="
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.foundry/bin:$PATH"

check_ver "eslint" "v${ESLINT_VER}"      "eslint -v 2>&1"
check_ver "prettier" "${PRETTIER_VER}"    "prettier --version 2>&1"
check_ver "typescript" "Version ${TYPESCRIPT_VER}" "tsc --version 2>&1"
check_ver "solhint" "${SOLHINT_VER}"      "solhint --version 2>&1"
check_ver "ruff" "${RUFF_VER}"            "ruff --version 2>&1 | awk '{print \$2}'"
check_ver "black" "${BLACK_VER}"          "black --version 2>&1 | head -1 | awk '{print \$2}'"
check_ver "mypy" "${MYPY_VER}"            "mypy --version 2>&1 | awk '{print \$2}'"
check_ver "radon" "${RADON_VER}"          "radon --version 2>&1"
check_ver "pip-audit" "${PIPAUDIT_VER}"   "pip-audit --version 2>&1"
echo "✅ node:  $(node -v)"
echo "✅ npm:   $(npm -v)"

check_ver() {
  local name=$1 expected=$2 cmd=$3
  local actual=$(eval "$cmd" 2>/dev/null | head -1)
  if echo "$actual" | grep -q "$expected"; then
    echo "✅ $name: $actual"
  else
    echo "❌ $name: got '$actual', expected '$expected'"
  fi
}

echo ""
echo "=== Install Complete ==="
echo "Run 'bash install-linters.sh' again to verify nothing changed."
