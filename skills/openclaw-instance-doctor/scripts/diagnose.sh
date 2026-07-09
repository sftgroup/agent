#!/bin/bash
# === OpenClaw Instance Doctor — 一键诊断 v1.0 ===
# 用法: bash diagnose.sh
# 在每台 OpenClaw 实例机器上运行，把输出发回给 stevenwang/team3

HOST=$(hostname)
IP=$(hostname -I | awk '{print $1}')
echo "=========================================="
echo "  OpenClaw Instance Doctor — 诊断报告"
echo "  hostname: $HOST | IP: $IP"
echo "  date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="
echo ""

# 找 openclaw.json
OC_JSON=""
for p in /root/.openclaw/openclaw.json /home/*/openclaw/openclaw.json ~/.openclaw/openclaw.json; do
  [ -f "$p" ] && OC_JSON="$p" && break
done

if [ -z "$OC_JSON" ]; then
  echo "❌ openclaw.json 未找到"
  exit 1
fi
echo "📄 openclaw.json: $OC_JSON"
echo ""

# --- 1. OpenClaw 版本 ---
echo "--- [1] OpenClaw Version ---"
openclaw --version 2>/dev/null || echo "❌ openclaw CLI 不可用"
echo ""

# --- 2. cacheRetention ---
echo "--- [2] cacheRetention ---"
VAL=$(python3 -c "import json;c=json.load(open('$OC_JSON'));print(c.get('cacheRetention','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
if [ "$VAL" = "long" ]; then echo "✅ $VAL"; elif [ "$VAL" = "NOT SET" ]; then echo "🔴 NOT SET (需要设为 'long')"; else echo "⚠️ $VAL"; fi
echo ""

# --- 3. heartbeat ---
echo "--- [3] heartbeat ---"
VAL=$(python3 -c "import json;c=json.load(open('$OC_JSON'));h=c.get('heartbeat',{});print(h.get('every','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
if [ "$VAL" = "55m" ]; then echo "✅ $VAL"; elif [ "$VAL" = "NOT SET" ]; then echo "🔴 NOT SET (需要设为 '55m')"; else echo "⚠️ $VAL (期望 55m)"; fi
echo ""

# --- 4. contextPruning ---
echo "--- [4] contextPruning ---"
MOD=$(python3 -c "import json;c=json.load(open('$OC_JSON'));p=c.get('contextPruning',{});print(p.get('mode','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
TTL=$(python3 -c "import json;c=json.load(open('$OC_JSON'));p=c.get('contextPruning',{});print(p.get('ttl','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
if [ "$MOD" = "cache-ttl" ] && [ "$TTL" = "1h" ]; then echo "✅ mode=$MOD, ttl=$TTL"; elif [ "$MOD" = "NOT SET" ]; then echo "🔴 NOT SET (需要 mode=cache-ttl, ttl=1h)"; else echo "⚠️ mode=$MOD, ttl=$TTL (期望 cache-ttl + 1h)"; fi
echo ""

# --- 5. contextInjection ---
echo "--- [5] contextInjection ---"
VAL=$(python3 -c "import json;c=json.load(open('$OC_JSON'));print(c.get('contextInjection','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
if [ "$VAL" = "always" ]; then echo "✅ $VAL"; elif [ "$VAL" = "NOT SET" ]; then echo "🔴 NOT SET (需要设为 'always')"; else echo "⚠️ $VAL"; fi
echo ""

# --- 6. bootstrapMaxChars & bootstrapTotalMaxChars ---
echo "--- [6] bootstrapMaxChars / bootstrapTotalMaxChars ---"
MAX=$(python3 -c "import json;c=json.load(open('$OC_JSON'));print(c.get('bootstrapMaxChars','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
TOT=$(python3 -c "import json;c=json.load(open('$OC_JSON'));print(c.get('bootstrapTotalMaxChars','NOT SET'))" 2>/dev/null || echo "PARSE ERROR")
S1=""; S2=""
[ "$MAX" = "20000" ] && S1="✅ bootstrapMaxChars=$MAX" || S1="⚠️ bootstrapMaxChars=$MAX (期望 20000)"
[ "$TOT" = "50000" ] && S2="✅ bootstrapTotalMaxChars=$TOT" || S2="⚠️ bootstrapTotalMaxChars=$TOT (期望 50000)"
echo "  $S1"
echo "  $S2"
echo ""

# --- 7. skipOptionalBootstrapFiles ---
echo "--- [7] skipOptionalBootstrapFiles ---"
FILES=$(python3 -c "import json;c=json.load(open('$OC_JSON'));sk=c.get('skipOptionalBootstrapFiles',[]);print(', '.join(sk))" 2>/dev/null || echo "PARSE ERROR")
HAS_SOUL=$(echo "$FILES" | grep -c "SOUL" || true)
HAS_HEART=$(echo "$FILES" | grep -c "HEARTBEAT" || true)
HAS_ID=$(echo "$FILES" | grep -c "IDENTITY" || true)
HAS_USR=$(echo "$FILES" | grep -c "USER" || true)
echo "  SOUL.md=$HAS_SOUL HEARTBEAT.md=$HAS_HEART IDENTITY.md=$HAS_ID USER.md=$HAS_USR"
if [ $HAS_SOUL -ge 1 ] && [ $HAS_HEART -ge 1 ]; then echo "  ✅ 关键文件已屏蔽"; else echo "  ⚠️ 建议屏蔽 SOUL.md + HEARTBEAT.md"; fi
echo ""

# --- 8. MCP Servers ---
echo "--- [8] MCP Servers ---"
python3 -c "
import json
c = json.load(open('$OC_JSON'))
servers = c.get('mcp', {}).get('servers', {})
for name, cfg in servers.items():
    url = cfg.get('url', cfg) if isinstance(cfg, dict) else str(cfg)
    print(f'  {name}: {url}')
print(f'  Total: {len(servers)} servers')
" 2>/dev/null || echo "❌ 无法解析 MCP"
echo ""

# --- 9. Agents ---
echo "--- [9] Agents ---"
python3 -c "
import json
c = json.load(open('$OC_JSON'))
agents = c.get('agents', {}).get('list', [])
for a in agents:
    m = a.get('model', {})
    model = m.get('primary', '') if isinstance(m, dict) else str(m)
    print(f'  {a[\"id\"]}: {model}')
print(f'  Total: {len(agents)} agents')
" 2>/dev/null || echo "❌ 无法解析 agents"
echo ""

# --- 10. 磁盘 ---
echo "--- [10] Disk ---"
df -h /
echo ""

# --- 11. 内存 ---
echo "--- [11] Memory ---"
free -h | head -2
echo ""

# --- 12. 运行中的 OpenClaw ---
echo "--- [12] OpenClaw Process ---"
ps aux | grep -i "[o]penclaw" | awk '{printf "  PID=%s CPU=%s MEM=%s CMD=%s\n",$2,$3,$4,$11}' || echo "  ⏹️ 未运行"
echo ""

# --- 总结 ---
echo "=========================================="
echo "  诊断完成"
echo "=========================================="
