#!/usr/bin/env bash
# OpenClaw Instance Doctor — 10-dimension diagnostic script
# Usage: sshpass -p '<PASS>' ssh ubuntu@<IP> 'bash -s' < diagnose.sh

echo '========================================'
echo '  诊断报告: ' && hostname
echo '========================================'

echo '--- 1. 基础信息 ---'
echo -n 'Hostname: ' && hostname
echo -n 'OpenClaw: ' && openclaw --version 2>/dev/null || echo 'NOT FOUND'
ps aux | grep '[o]penclaw' | grep -v chrome | awk '{print "PID:",$2,"CMD:",$11,$12,$13}'
ss -tlnp 2>/dev/null | grep node | head -3
df -h / | tail -1
uptime

echo '--- 2. 主 AGENTS.md ---'
if [ -f ~/.openclaw/workspace/AGENTS.md ]; then
  head -1 ~/.openclaw/workspace/AGENTS.md
  echo "行数: $(wc -l < ~/.openclaw/workspace/AGENTS.md)"
else
  echo '❌ MISSING'
fi

echo '--- 3. 子 Agent 清单 ---'
for d in qa security security-check security-check-centralized tester \
  ui-design-critique ux-researcher design-advisor ui-designer; do
  f=$(find ~/.openclaw/workspace -maxdepth 3 -path "*/$d/AGENTS.md" ! -path "*node_modules*" 2>/dev/null | head -1)
  [ -f "$f" ] && echo "✅ $d: $(wc -l < "$f")L" || echo "❌ $d: MISSING"
done

echo '--- 4. 旧版残留 ---'
[ -d ~/.openclaw/workspaces ] && echo '❌ workspaces/ 存在' || echo '✅ 无 workspaces/'
[ -d ~/.openclaw/agents ] && echo 'agents/ 存在 (运行时)' || echo '✅ 无 agents/'

echo '--- 5. Config 关键项 ---'
python3 << 'PYEOF'
import json, os
c = json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))
print('bind:', c.get('gateway',{}).get('bind','?'))
d = c.get('agents',{}).get('defaults',{})
print('contextInjection:', d.get('contextInjection','?'))
print('skipOptional:', d.get('skipOptionalBootstrapFiles','?'))
print('workspace:', d.get('workspace','?'))
print('compaction:', d.get('compaction',{}))
print('model:', d.get('model',{}).get('primary','?'))
print('Agents:', [a['id'] for a in c.get('agents',{}).get('list',[])])
ds = c.get('models',{}).get('providers',{}).get('deepseek',{})
print('DeepSeek timeout:', ds.get('timeoutSeconds','?'))
PYEOF

echo '--- 6. 安全工具 (15项) ---'
export PATH="$HOME/.cargo/bin:$HOME/.foundry/bin:$HOME/.nvm/versions/node/*/bin:$HOME/.local/bin:/usr/local/bin:$HOME/go/bin:$PATH"
for t in forge slither aderyn semgrep solhint echidna bandit \
  nmap nuclei nikto eslint lynis gitleaks trivy autotest; do
  which "$t" >/dev/null 2>&1 && echo "✅ $t" || echo "❌ $t MISSING"
done

echo '--- 7. Qdrant 同步 ---'
for f in sync_memory_to_qdrant.py sync_all_to_qdrant.py; do
  [ -f ~/${f} ] && echo "✅ ~/${f}" || echo "❌ ~/${f} MISSING"
done
find ~/scripts -name '*qdrant*' -o -name '*sync*' 2>/dev/null | while read f; do echo "✅ $f"; done
crontab -l 2>/dev/null | grep -i qdrant || echo '❌ 无 Qdrant crontab'
curl -s --connect-timeout 5 -H "api-key: qc_a1hunter_f2f079163e7fc24366c0475221c575fb" \
  http://182.254.140.44:6333/collections 2>/dev/null | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(f'{len(d.get(\"result\",{}).get(\"collections\",[]))} collections')" 2>/dev/null || echo '❌ Qdrant 不通'

echo '--- 8. Session 管理 ---'
python3 -c "
import json, os
c = json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))
s = c.get('session',{})
print('reset:', json.dumps(s.get('reset',{})))
print('maintenance:', json.dumps(s.get('maintenance',{})))
"

echo '--- 9. 浏览器清理 ---'
for f in chrome-cleanup.sh kill-idle-browser.sh; do
  for d in ~/scripts ~/.openclaw/scripts; do
    [ -f "$d/$f" ] && echo "✅ $d/$f"
  done
done
crontab -l 2>/dev/null | grep -i chrome || echo '❌ 无 Chrome 清理 crontab'

echo '--- 10. 磁盘详情 ---'
df -h / | tail -1
du -sh /home/ubuntu/*/ /home/ubuntu/.*/ 2>/dev/null | sort -rh | head -10
