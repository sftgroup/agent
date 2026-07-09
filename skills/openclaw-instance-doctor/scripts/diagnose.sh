#!/usr/bin/env bash
# OpenClaw Instance Doctor — 8-dimension diagnostic script
# Focus: cache-hit chain + session mgmt + disk + browser + Gateway health
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

echo '--- 3. 子 Agent 清单 (9个) ---'
AGENTS_OK=0; AGENTS_FAIL=0
for d in qa security security-check security-check-centralized tester \
  ui-design-critique ux-researcher design-advisor ui-designer; do
  f=$(find ~/.openclaw/workspace -maxdepth 3 -path "*/$d/AGENTS.md" ! -path "*node_modules*" 2>/dev/null | head -1)
  if [ -f "$f" ]; then
    echo "✅ $d: $(wc -l < "$f")L"; AGENTS_OK=$((AGENTS_OK+1))
  else
    echo "❌ $d: MISSING"; AGENTS_FAIL=$((AGENTS_FAIL+1))
  fi
done
echo "合计: $AGENTS_OK 存在, $AGENTS_FAIL 缺失"

echo '--- 4. 旧版残留 ---'
[ -d ~/.openclaw/workspaces ] && echo '❌ workspaces/ 存在 (旧版, 应清理)' || echo '✅ 无 workspaces/'
[ -d ~/.openclaw/agents ] && echo '✅ agents/ 存在 (运行时存储)' || echo '⚠️  agents/ 不存在'

echo '--- 5. Config ---'
python3 << 'PYEOF'
import json, os
c = json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))
print('gateway.bind:', c.get('gateway',{}).get('bind','?'))
d = c.get('agents',{}).get('defaults',{})
print('contextInjection:', d.get('contextInjection','?'))
print('skipOptional:', d.get('skipOptionalBootstrapFiles','?'))
print('bootstrapMaxChars:', d.get('bootstrapMaxChars','?'))
print('bootstrapTotalMaxChars:', d.get('bootstrapTotalMaxChars','?'))
print('compaction:', json.dumps(d.get('compaction',{})))
print('cacheRetention:', d.get('params',{}).get('cacheRetention','NOT SET'))
print('heartbeat:', json.dumps(d.get('heartbeat',{})))
print('contextPruning:', json.dumps(d.get('contextPruning',{})))
print('model:', d.get('model',{}).get('primary','?'))
print('Agents count:', len(c.get('agents',{}).get('list',[])))
print('Agents:', [a['id'] for a in c.get('agents',{}).get('list',[])])
ds = c.get('models',{}).get('providers',{}).get('deepseek',{})
print('DeepSeek timeout:', ds.get('timeoutSeconds','?'))
s = c.get('session',{})
print('session.reset:', json.dumps(s.get('reset',{})))
print('session.maintenance:', json.dumps(s.get('maintenance',{})))
PYEOF

echo '--- 6. Cache Hit Chain ---'
python3 << 'PYEOF'
import json, os
c = json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))
d = c.get('agents',{}).get('defaults',{})

checks = []
ci = d.get('contextInjection') == 'always'
checks.append(('stable prefix (contextInjection=always)', ci))
cr = d.get('params',{}).get('cacheRetention') == 'long'
checks.append(('cacheRetention=long', cr))
hb = bool(d.get('heartbeat',{}).get('every'))
checks.append(('heartbeat keep-warm', hb))
cp = d.get('contextPruning',{}).get('mode') == 'cache-ttl'
checks.append(('contextPruning=cache-ttl', cp))
bt = d.get('bootstrapTotalMaxChars', 0) >= 50000
checks.append(('bootstrapTotalMaxChars>=50000', bt))
so = 'HEARTBEAT.md' in d.get('skipOptionalBootstrapFiles', [])
checks.append(('skipOptional covers HEARTBEAT.md', so))
comp = d.get('compaction',{})
cc = comp.get('reserveTokens') == 12000 and comp.get('keepRecentTokens') == 20000
checks.append(('compaction baseline (12K/20K)', cc))

for name, ok in checks:
    print(f"  {'✅' if ok else '❌'} {name}")

score = sum(1 for _, ok in checks if ok)
print(f'\n缓存命中链完整度: {score}/{len(checks)}')
PYEOF

echo '--- 7. 浏览器清理 ---'
BROWSER_OK=0
for f in chrome-cleanup.sh kill-idle-browser.sh; do
  for d in ~/scripts ~/.openclaw/scripts; do
    if [ -f "$d/$f" ]; then echo "✅ $d/$f"; BROWSER_OK=$((BROWSER_OK+1)); fi
  done
done
[ $BROWSER_OK -eq 0 ] && echo '❌ 无浏览器清理脚本'
crontab -l 2>/dev/null | grep -i chrome && echo '✅ chrome crontab 已配置' || echo '❌ 无 Chrome 清理 crontab'

echo '--- 8. 磁盘 ---'
df -h / | tail -1
echo ''
echo '大目录 TOP 8:'
du -sh /home/ubuntu/*/ /home/ubuntu/.*/ 2>/dev/null | sort -rh | head -8
echo ''
echo '缓存详情:'
for d in /home/ubuntu/.npm /home/ubuntu/.cache /home/ubuntu/.local/share/pnpm /tmp; do
  echo -n "  $d: " && du -sh "$d" 2>/dev/null || echo '(none)'
done
journalctl --disk-usage 2>/dev/null | xargs -I{} echo "  journal: {}"
