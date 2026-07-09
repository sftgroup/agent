#!/usr/bin/env bash
# Deploy Code Review MCP Server
# Run on central server (team3: 43.156.50.6)
set -e

echo "=== Code Review MCP Deploy ==="

# 1. Install deps
echo "1. Installing tools..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

# Node tools
npm list -g eslint 2>/dev/null | grep -q eslint || npm install -g eslint
npm list -g prettier 2>/dev/null | grep -q prettier || npm install -g prettier
npm list -g solhint 2>/dev/null | grep -q solhint || npm install -g solhint
npm list -g typescript 2>/dev/null | grep -q typescript || npm install -g typescript

# Python tools
pip3 list 2>/dev/null | grep -qi "^ruff " || pip3 install --break-system-packages ruff
pip3 list 2>/dev/null | grep -qi "^black " || pip3 install --break-system-packages black
pip3 list 2>/dev/null | grep -qi "^mypy " || pip3 install --break-system-packages mypy
pip3 list 2>/dev/null | grep -qi "^radon " || pip3 install --break-system-packages radon
pip3 list 2>/dev/null | grep -qi "^pip-audit " || pip3 install --break-system-packages pip-audit

echo "   ✅ tools installed"

# 2. Install service
echo "2. Installing systemd service..."
mkdir -p ~/.config/systemd/user
cp code-review-mcp.service ~/.config/systemd/user/
systemctl --user daemon-reload
echo "   ✅ service installed"

# 3. Start
echo "3. Starting..."
systemctl --user stop code-review-mcp 2>/dev/null || true
systemctl --user start code-review-mcp
sleep 2

if systemctl --user is-active code-review-mcp --quiet; then
    echo "   ✅ running"
else
    echo "   ❌ failed to start"
    journalctl --user -u code-review-mcp --no-pager -n 10
    exit 1
fi

# 4. Test
echo "4. Testing..."
curl -s http://127.0.0.1:9020/health && echo ""
curl -s -X POST http://127.0.0.1:9020/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('MCP init:', d.get('result',{}).get('serverInfo',{}).get('name','FAIL'))"

echo ""
echo "=== Deploy complete ==="
echo "MCP URL: http://43.156.50.6:9020/mcp"
