# OpenClaw Instance Doctor — 多机实例诊断对齐 Skill

## 概述
对远程 OpenClaw 实例执行标准化 10 维度诊断，识别差距项，按用户决策执行对齐修复。

## 适用场景
- 新机器接诊断 / 巡检 / 磁盘清理 / 工具安装 / 配置对齐

## 执行约束
- **诊断前**：先 SSH 连接确认可达，再执行诊断
- **用户确认前**：不修改任何配置，仅诊断和展示
- **不修改安装路径**：只补装缺失工具
- **不删 agents/ 目录**：OpenClaw 运行时存储
- **停 Gateway 再改 config**：先 stop，改完再 restart
- **workspace 路径不改**：绝对路径能正常工作时保持不变

## Phase 1: 全维度诊断（只读）

对目标机执行以下诊断脚本。用 `sshpass + SSH heredoc` 一次性下发，结果结构化展示给用户。

```bash
sshpass -p '<PASSWORD>' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@<TARGET_IP> 'bash -s' << 'DIAG'
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
DIAG
```

## Phase 2: 差距分析

将诊断结果与基线标准对比，生成结构化报告：

| 维度 | 检查项 | 基线值 | 状态 |
|------|--------|--------|------|
| 主 AGENTS.md | 存在/行数 | 200-300L | ✅/❌ |
| 子 Agent | 9个全存在 | 全有 | ✅/⚠️ |
| contextInjection | actual | `always` | ✅/⚠️ |
| compaction | reserveTokens | 12000 | ✅/⚠️ |
| compaction | keepRecentTokens | 20000 | ✅/⚠️ |
| compaction | maxHistoryShare | 0.6 | ✅/⚠️ |
| Gateway bind | actual | `lan` | ✅/⚠️ |
| DeepSeek timeout | actual | 300 | ✅/⚠️ |
| 安全工具 | 数量 | 15/15 | ✅/⚠️ |
| Qdrant 同步 | crontab+脚本 | 有 | ✅/⚠️ |
| Session reset | idleMinutes | 480 | ✅/⚠️ |
| 浏览器清理 | L1+L2+crontab | 有 | ✅/⚠️ |
| 磁盘 | 使用率 | <80% | ✅/⚠️ |
| Gateway | 运行中 | 运行中 | ✅/⚠️ |

差距项列成待决策清单，逐项说明风险和开销，**等用户确认后再执行**。

## Phase 3: 执行对齐

按用户确认的项，逐台机器执行：

### 3.1 磁盘清理
```bash
sshpass -p '<PASSWORD>' ssh ubuntu@<IP> 'bash -s' << 'CLEAN'
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm cache clean --force 2>/dev/null
pnpm store prune 2>/dev/null
sudo journalctl --vacuum-size=500M 2>/dev/null
pip cache purge 2>/dev/null; go clean -cache 2>/dev/null
sudo apt-get clean 2>/dev/null
sudo find /tmp -type f -atime +1 -delete 2>/dev/null
df -h / | tail -1
CLEAN
```

### 3.2 安装缺失工具
```bash
sshpass -p '<PASSWORD>' ssh ubuntu@<IP> 'bash -s' << 'INSTALL'
npm install -g solhint eslint 2>/dev/null
pip3 install --break-system-packages bandit 2>/dev/null
# echidna/gitleaks/trivy → wget/curl install
INSTALL
```

### 3.3 同步 AGENTS.md
从本机推送到目标机：
```bash
# 主 AGENTS.md 适配：sed 's/team3/team{N}/g; s/43.156.50.6/<TARGET_IP>/g'
# 子 Agent 直接 cat over SSH
# 先 mkdir -p 缺失目录
```

### 3.4 修改 config.json
用 Python 脚本修改 `openclaw.json`：
- compaction.reserveTokens = 12000（不是 200000）
- 清理废弃 agent（verifier/ui-reviewer 等）
- contextInjection → `always`（如需要）

### 3.5 重启 Gateway
```bash
systemctl --user stop openclaw-gateway; sleep 3
systemctl --user start openclaw-gateway; sleep 10
ss -tlnp | grep <PORT> && echo '✅ UP' || echo '❌ DOWN'
```

### 3.6 最终验证
重新执行 Phase 1 诊断脚本，确认所有项对齐。

## Phase 4: 库级同步（可选）

将最新 AGENTS.md 推送到 GitHub：
- `github.com/sftgroup/agent` — agents/ 目录（11 个 agent 文件 + SOP + skills/）

## 基线标准速查卡

| 配置项 | 基线值 |
|--------|--------|
| contextInjection | always |
| compaction.reserveTokens | 12000 |
| compaction.keepRecentTokens | 20000 |
| compaction.maxHistoryShare | 0.6 |
| compaction.recentTurnsPreserve | 3 |
| compaction.notifyUser | true |
| gateway.bind | lan |
| deepseek.timeoutSeconds | 300 |
| session.reset.idleMinutes | 480 |
| session.maintenance.pruneAfter | 30d |
| session.maintenance.maxEntries | 1000 |
| agent 总数 | 10（主 + 9 子） |
| 安全工具 | 15/15 |

## 实例凭据

| 凭据 | 值 |
|-------|-----|
| 用户名 | ubuntu |
| 密码 | Asdf1234! |
| SSH 超时 | ConnectTimeout=10 |

## 相关资源

- SOP 完整文档：`docs/openclaw-alignment-sop.md`
- Agent 仓库：`github.com/sftgroup/agent`
- Qdrant 服务端：`182.254.140.44:6333`
