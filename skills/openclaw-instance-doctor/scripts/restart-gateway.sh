#!/usr/bin/env bash
# OpenClaw Instance Doctor — Gateway restart script
# Stops, verifies stopped, starts, verifies running.
# Usage: bash restart-gateway.sh

set -e
PORT="${1:-34182}"
echo "=== Gateway Restart ==="

echo "1. Stopping..."
systemctl --user stop openclaw-gateway 2>/dev/null || pkill -f 'openclaw.*gateway' 2>/dev/null
sleep 3

if ps aux | grep -q '[o]penclaw.*gateway'; then
  echo "   ❌ Still running, force kill..."
  pkill -9 -f 'openclaw.*gateway' 2>/dev/null
  sleep 2
fi
echo "   stopped"

echo "2. Starting..."
systemctl --user reset-failed openclaw-gateway 2>/dev/null
systemctl --user start openclaw-gateway
sleep 8

if ss -tlnp 2>/dev/null | grep -q ":$PORT"; then
  echo "   ✅ UP on :$PORT"
else
  echo "   ❌ DOWN on :$PORT, checking logs..."
  journalctl --user -u openclaw-gateway --no-pager -n 5
  exit 1
fi

echo "=== Restart complete ==="
