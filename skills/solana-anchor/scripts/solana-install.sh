#!/usr/bin/env bash
# solana-install.sh — Auto-install Solana CLI toolchain (Agave 2.3.3)
# Usage: bash solana-install.sh
# Idempotent: skips if solana + cargo-build-sbf already on PATH.

set -euo pipefail

AGAVE_VERSION="${AGAVE_VERSION:-2.3.3}"
INSTALL_DIR="$HOME/.local/share/solana/install"
AGAVE_INIT_URL="https://release.anza.xyz/v${AGAVE_VERSION}/agave-install-init-x86_64-unknown-linux-gnu"

echo "=== Checking Solana toolchain ==="

# Already installed?
if command -v solana &>/dev/null && command -v cargo-build-sbf &>/dev/null; then
  echo "✅ Solana CLI already installed: $(solana --version)"
  echo "✅ cargo-build-sbf available"
  exit 0
fi

echo ""
echo "=== Installing Agave ${AGAVE_VERSION} ==="

# Download installer
mkdir -p "$INSTALL_DIR"
curl -sSfL "$AGAVE_INIT_URL" -o "$INSTALL_DIR/agave-install-init"
chmod +x "$INSTALL_DIR/agave-install-init"

echo "Running agave-install init ${AGAVE_VERSION}..."
"$INSTALL_DIR/agave-install-init" "$AGAVE_VERSION" 2>&1

# Add to PATH for this session
RELEASE_DIR="$INSTALL_DIR/active_release/bin"
export PATH="$RELEASE_DIR:$PATH"

# Verify
echo ""
echo "=== Verification ==="
if command -v solana &>/dev/null; then
  echo "✅ solana: $(solana --version)"
else
  echo "❌ solana not found after install"
  exit 1
fi

if command -v cargo-build-sbf &>/dev/null; then
  echo "✅ cargo-build-sbf: $(cargo-build-sbf --version 2>&1 | head -1 || echo 'available')"
else
  echo "❌ cargo-build-sbf not found after install"
  exit 1
fi

echo ""
echo "=== PATH setup ==="
echo "Add this to your shell profile (~/.bashrc, ~/.zshrc):"
echo ""
echo "  export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
echo ""

# Check for edition2024 compatibility
RUSTC_VER=$("$HOME/.cache/solana/v1.48/rust/bin/rustc" --version 2>/dev/null | grep -oP '\d+\.\d+' || echo "unknown")
echo "SBF rustc version: $RUSTC_VER"
if [[ "$RUSTC_VER" < "1.85" ]]; then
  echo "⚠️  This toolchain does NOT support edition2024. Use edition = \"2021\" in Cargo.toml."
  echo "   See SKILL.md § Toolchain & Edition Compatibility for platform-tools swap."
fi

echo ""
echo "=== Done ==="
