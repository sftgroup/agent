#!/usr/bin/env bash
# OpenClaw Instance Doctor — disk cleanup script
# Cleans: npm cache, pnpm store, pip cache, go build cache, apt cache, journal, /tmp
# Safe to run on any Ubuntu instance. Does NOT touch application data.
# Usage: bash cleanup-disk.sh

set -e
echo "=== Disk Cleanup ==="
echo "Before: $(df -h / | tail -1 | awk '{print $3, "used /", $2, "total (" $5 ")"}')"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

echo "1. npm cache..."
npm cache clean --force 2>/dev/null && echo "   done" || echo "   skipped (npm not available)"

echo "2. pnpm store..."
pnpm store prune 2>/dev/null && echo "   done" || echo "   skipped (pnpm not available)"

echo "3. pip cache..."
pip cache purge 2>/dev/null && echo "   done" || echo "   skipped (pip not available)"

echo "4. go build cache..."
go clean -cache 2>/dev/null && echo "   done" || echo "   skipped (go not available)"

echo "5. apt cache..."
sudo apt-get clean 2>/dev/null && echo "   done" || echo "   skipped"

echo "6. journal (keep 500M)..."
sudo journalctl --vacuum-size=500M 2>/dev/null | tail -1 || echo "   skipped"

echo "7. /tmp (files older than 1 day)..."
sudo find /tmp -type f -atime +1 -delete 2>/dev/null
sudo find /tmp -type d -empty -delete 2>/dev/null
echo "   done"

echo "8. user trash..."
rm -rf ~/.trash/* ~/.trash/.[!.]* 2>/dev/null; echo "   done"

echo ""
echo "After:  $(df -h / | tail -1 | awk '{print $3, "used /", $2, "total (" $5 ")"}')"
echo "=== Cleanup complete ==="
