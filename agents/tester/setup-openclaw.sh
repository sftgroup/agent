#!/bin/bash
# OpenClaw MCP 接入脚本
# 在每台 OpenClaw 实例上执行（不需要在 MCP 服务器上执行）
# 用法: MCP_IP=43.156.46.187 bash setup-openclaw.sh
set -e

MCP_IP=${MCP_IP:-"YOUR_MCP_SERVER_IP"}

echo "=== Adding autotest MCP servers (${MCP_IP}) ==="

openclaw mcp add autotest-web3 --transport sse --url "http://${MCP_IP}:8081/sse" --timeout 300 --no-probe
openclaw mcp add autotest-web  --transport sse --url "http://${MCP_IP}:8082/sse" --timeout 300 --no-probe
openclaw mcp add autotest-dapp --transport sse --url "http://${MCP_IP}:8083/sse" --timeout 300 --no-probe

echo ""
echo "=== Verifying ==="
openclaw mcp list
echo ""
echo "=== Done ==="
echo "Next: install tester skill, see README.md"
