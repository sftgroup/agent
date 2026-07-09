# OpenClaw 多机对齐标准化方案 v2.0

## 目标

将任意数量 OpenClaw 实例统一到相同基线，实现主 Agent + 子 Agent + 配置 + 安全工具 + Qdrant 同步全量对齐。

---

## 〇、全量实例清单

### 核心实例（8 台）

| IP | 角色 | Team ID | INSTANCE_NAME | 状态 |
|----|------|---------|---------------|------|
| `43.156.50.6` | Team 3 (本机) | team3 | `openclaw-team3` | ✅ 基线 |
| `43.156.138.166` | Team 1 | team1 | `openclaw-team1` | 🔲 待诊断 |
| `43.156.55.212` | Team 2 | team2 | `openclaw-team2` | ✅ 已对齐 |
| `43.133.37.213` | Team 3 (备) | team3 | `openclaw-team3` | 🔲 待诊断 |
| `43.159.60.46` | Team 4 | team4 | `openclaw-team4` | ✅ 已对齐 |
| `124.156.203.132` | Team 5 | team5 | `openclaw-team5` | 🔲 待诊断 |
| `129.226.203.60` | Team 6 / 产品体验链 | team6 / product-chain | `openclaw-team6` / `openclaw-product-chain` | ✅ 已对齐 |

### 测试服务器

| IP | 对应团队 | 端口 |
|----|---------|------|
| `129.226.202.72` | Team 1 | 3001 |
| `43.156.78.59` | Team 2 | 3002 |
| `43.156.50.6` | Team 3 | 3003 |
| `43.159.39.85` | Team 4 | 3004 |
| `43.133.37.108` | Team 5/6 | 3005/3006 |

### 基础设施

| IP | 角色 | 端口 |
|----|------|------|
| `182.254.140.44` | Qdrant 向量数据库 | 6333 |
| `101.33.109.117` | NFS Server | — |

> 所有服务器凭据：`ubuntu / Asdf1234!`

---

## 一、基线标准

### 1.1 子 Agent 清单（9 个）
```
qa (162行)  security (295行)  security-check (262行)  security-check-centralized (197行)
tester (118行)  ui-design-critique (65行)  ux-researcher (25行)
design-advisor (25行)  ui-designer (35行)
```

### 1.2 Config 标准
| 配置项 | 值 |
|--------|-----|
| `gateway.bind` | `lan` |
| `agents.defaults.contextInjection` | `always` |
| `agents.defaults.skipOptionalBootstrapFiles` | `["SOUL.md","HEARTBEAT.md","IDENTITY.md","USER.md"]` |
| `agents.defaults.workspace` 和子 agent workspace | **相对路径** (`workspace`, `workspace/qa` ...) |
| `models.providers.deepseek.timeoutSeconds` | `300` |
| OpenClaw 版本 | `2026.6.11` |

### 1.3 安全工具（15 项）
```
forge  slither  aderyn  semgrep  solhint  echidna  bandit
nmap  nuclei  nikto  eslint  lynis  gitleaks  trivy  autotest
```

> **autotest 仓库**: https://github.com/sftgroup/autotest (公开) | **autoops**: https://github.com/sftgroup/autoops (私密)
> autotest v1.4 — 869 行纯 bash，三方审计通过（security-check + security + QA），19/19 全绿

### 1.4 Compaction 标准

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `compaction.reserveTokens` | `12000` | 压缩后保留的最小 token 预算 |
| `compaction.keepRecentTokens` | `20000` | 保留最近消息的 token 预算 |
| `compaction.maxHistoryShare` | `0.6` | 历史消息最多占上下文 60% |
| `compaction.recentTurnsPreserve` | `3` | 始终保留最近 3 轮完整对话 |
| `compaction.notifyUser` | `true` | 压缩时通知用户 |

> 💡 **纯手动模式**：如要完全禁用自动 compaction，可将 agent 级 `contextTokens` 拉大到 2,000,000（远超实际使用量），如此 compaction 永远不会自动触发。team7 已采用此方案。

### 1.5 Qdrant 同步标准
| 配置项 | 值 |
|--------|-----|
| Qdrant 服务器 | `182.254.140.44:6333` |
| API Key | `qc_a1hunter_f2f079163e7fc24366c0475221c575fb` |
| Embedding 模型 | Qwen `text-embedding-v4`（512维，Cosine） |
| 同步频率 | 每 10 分钟 crontab |
| 同步脚本路径 | `~/sync_all_to_qdrant.py` 或 `~/scripts/sync_all_to_qdrant.py` |
| 集合 | `shared_knowledge_v2`, `agent_memories_v2`, `agent_conversations_v2`, `project_knowledge_v2` |

### 1.6 Session 管理标准
| 配置项 | 值 | 说明 |
|--------|-----|------|
| `session.reset.mode` | `idle` | 空闲时自动重置 |
| `session.reset.idleMinutes` | `480` (8小时) | 空闲 8 小时后重置 |
| `session.maintenance.mode` | `enforce` | 强制执行清理 |
| `session.maintenance.pruneAfter` | `30d` | 30 天未活动删除 |
| `session.maintenance.maxEntries` | `1000` | 最多保留 1000 条记录 |
| `session.resetArchiveRetention` | `7d` | 重置归档保留 7 天 |

### 1.7 浏览器清理标准
| 检查项 | 标准 |
|--------|------|
| chrome-cleanup.sh (L1) | crontab 每 10 分钟，清理 idle>30m 的 renderer 子进程 |
| kill-idle-browser.sh (L2) | crontab 每 30 分钟，清理 idle>2h 的主进程 |
| 脚本路径 | `~/scripts/` 或 `~/.openclaw/scripts/` |

### 1.8 完整运维时间线（参考）
```
每 请求     → System Prompt 完整注入 + Prompt Cache 检查
每 请求     → 对话捕获 (L0) + 结构化记忆 (L1) + 向量索引更新
每 请求     → Compaction 检查（contextTokens 足够大时不触发）
每 60s      → Session idle 检测
每 10min    → Chrome cleanup L1
每 10min    → Qdrant 向量同步
每 30min    → Chrome cleanup L2
每 8h       → Session idle Reset（归档 + 重建）
每 7d       → Reset 归档过期删除
每 30d      → Session prune
每 1000 条  → Session 总量上限裁剪
```

---

## 二、前置检查

### Step 1: 探测机器环境
```bash
# 确认 SSH 可达
ssh ubuntu@<TARGET_IP> "echo alive && whoami"

# 确认 OpenClaw 存在
ssh ubuntu@<TARGET_IP> "which openclaw && openclaw --version"

# 确认 openclaw 运行状态
ssh ubuntu@<TARGET_IP> "
  # 进程
  ps aux | grep '[o]penclaw' | grep -v chrome
  # 端口
  ss -tlnp | grep node
  # systemd
  ls ~/.config/systemd/user/openclaw* 2>/dev/null
  systemctl --user status openclaw-gateway 2>/dev/null | head -5
"
```

### Step 2: 诊断现有配置（全量一键诊断脚本）
```bash
ssh ubuntu@<TARGET_IP> 'bash -s' << 'DIAG'
echo '========================================'
echo '  诊断报告'
echo '========================================'
echo ''

echo '--- 1. 基础信息 ---'
echo -n 'Hostname: ' && hostname
echo -n 'OpenClaw: ' && openclaw --version 2>/dev/null || echo 'NOT FOUND'
ps aux | grep '[o]penclaw' | grep -v chrome | awk '{print "PID:",$2,"CMD:",$11,$12,$13}'
ss -tlnp 2>/dev/null | grep node | head -3
df -h / | tail -1
echo ''

echo '--- 2. 主 AGENTS.md ---'
if [ -f ~/.openclaw/workspace/AGENTS.md ]; then
  echo -n '标题: ' && head -1 ~/.openclaw/workspace/AGENTS.md
  echo -n '行数: ' && wc -l < ~/.openclaw/workspace/AGENTS.md
  echo '队名/IP:'
  grep -nE 'team|43\.|124\.|129\.' ~/.openclaw/workspace/AGENTS.md | head -5
else
  echo '❌ MISSING'
fi
echo ''

echo '--- 3. 子 Agent 清单 ---'
for d in qa security security-check security-check-centralized tester \
  ui-design-critique ux-researcher design-advisor ui-designer; do
  f=~/.openclaw/workspace/\$d/AGENTS.md
  if [ -f "\$f" ]; then
    echo "✅ \$d: \$(wc -l < "\$f")L 标题: \$(head -1 "\$f")"
  else
    echo "❌ \$d: MISSING"
  fi
done
echo ''

echo '--- 4. 旧版残留 ---'
[ -d ~/.openclaw/workspaces ] && echo '❌ workspaces/ 存在' || echo '✅ 无 workspaces/'
[ -d ~/.openclaw/agents ] && echo 'agents/ 存在 (运行时目录)' || echo '✅ 无 agents/'
echo ''

echo '--- 5. Config 关键项 ---'
python3 << 'PYEOF'
import json, os
c = json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))
print('Gateway bind:', c.get('gateway',{}).get('bind','?'))
d = c.get('agents',{}).get('defaults',{})
print('contextInjection:', d.get('contextInjection','?'))
print('skipOptional:', d.get('skipOptionalBootstrapFiles','?'))
print('workspace:', d.get('workspace','?'))
print('compaction:', d.get('compaction',{}))
print('model:', d.get('model',{}).get('primary','?'))
print()
print('Agent List:')
for a in c.get('agents',{}).get('list',[]):
    print(f"  {a['id']:30s} workspace: {a.get('workspace','?')}")
ds = c.get('models',{}).get('providers',{}).get('deepseek',{})
print()
print('DeepSeek timeout:', ds.get('timeoutSeconds','?'))
PYEOF
echo ''

echo '--- 6. 安全工具 (15项) ---'
export PATH="\$HOME/.cargo/bin:\$HOME/.foundry/bin:\$HOME/.nvm/versions/node/*/bin:\$HOME/.local/bin:/usr/local/bin:\$HOME/go/bin:\$PATH"
for t in forge slither aderyn semgrep solhint echidna bandit nmap nuclei nikto eslint lynis gitleaks trivy autotest; do
  which "\$t" >/dev/null 2>&1 && echo "✅ \$t" || echo "❌ \$t MISSING"
done
# autotest 版本
echo -n 'autotest 版本: '
autotest --version 2>/dev/null || autotest version 2>/dev/null || echo '(无版本命令)'
echo ''

echo '--- 7. Qdrant 同步检查 ---'
# 同步脚本
for f in sync_memory_to_qdrant.py sync_memory_to_qdrant_v3.py sync_all_to_qdrant.py; do
  [ -f ~/\$f ] && echo "✅ \$f" || echo "❌ \$f MISSING"
done
# crontab
echo -n 'Crontab: '
crontab -l 2>/dev/null | grep -i qdrant && echo '' || echo '❌ 无 Qdrant 定时任务'
# Qdrant 连通性
echo -n 'Qdrant 连通: '
curl -s --connect-timeout 5 -H "api-key: qc_a1hunter_f2f079163e7fc24366c0475221c575fb" \
  http://182.254.140.44:6333/collections 2>/dev/null | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(f'✅ {len(d.get(\"result\",{}).get(\"collections\",[]))} collections')" 2>/dev/null || echo '❌ 无法连接'
# Qdrant 日志最近条目
echo -n '最近同步: '
tail -3 /tmp/qdrant_sync*.log 2>/dev/null | tail -1 || echo '❌ 无日志'

echo ''
echo '--- 8. 磁盘空间 ---'
df -h / | tail -1
DIAG
```

---

## 三、Qdrant 同步诊断（独立步骤）

### 检查同步状态
```bash
ssh ubuntu@<TARGET_IP> 'bash -s' << 'QCHECK'
echo "=== Qdrant 同步检查 ==="

# 1. 同步脚本
for f in sync_memory_to_qdrant.py sync_memory_to_qdrant_v3.py sync_all_to_qdrant.py; do
  [ -f ~/\$f ] && echo "✅ \$f" || echo "❌ \$f MISSING"
done

# 2. crontab
echo -n 'Crontab: '
crontab -l 2>/dev/null | grep -i qdrant || echo '❌ 未配置'

# 3. 连通性
echo -n '连通 182.254.140.44:6333: '
curl -s --connect-timeout 5 -H "api-key: qc_a1hunter_f2f079163e7fc24366c0475221c575fb" \
  http://182.254.140.44:6333/collections 2>/dev/null | \
  python3 -c "import json,sys; d=json.load(sys.stdin); [print(c['name'], '-', c['vectors_count'], 'points') for c in d['result']['collections']]" 2>/dev/null || echo '❌ 无法连接'

# 4. 最近日志
find /tmp -name 'qdrant_sync*.log' -exec tail -3 {} \; 2>/dev/null || echo '❌ 无日志'

# 5. INSTANCE_NAME 检查
grep -rn 'INSTANCE_NAME\|instance_name' ~/sync_*_qdrant*.py ~/sync_*_to_qdrant*.py 2>/dev/null | head -5
QCHECK
```

### Qdrant 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 连接超时 | 防火墙未放行 6333 | 联系管理员 |
| Invalid API key | API Key 错误 | 检查 `qc_a1hunter_f2f079163e7fc24366c0475221c575fb` |
| Embedding 失败 | Qwen API Key 无效 | 检查 .env 中的 QWEN_API_KEY |
| 写入但搜索不到 | `wait=false` 异步写入 | 等几秒再搜 |
| 维度不匹配 400 | 用了错误维度 | 确认 512 维 |

---

## 四、执行对齐

### Step 10: 停 Gateway
```bash
ssh ubuntu@<TARGET_IP> "
  systemctl --user stop openclaw-gateway 2>/dev/null
  pkill -f 'openclaw.*gateway' 2>/dev/null
  sleep 3
  ps aux | grep '[o]penclaw.*gateway' | grep -v grep && echo 'STILL RUNNING' || echo 'stopped'
"
```

### Step 11: 创建/清理目录
```bash
ssh ubuntu@<TARGET_IP> "
  rm -rf ~/.openclaw/workspaces ~/.openclaw/agents  # 清旧版残留
  mkdir -p ~/.openclaw/workspace/{qa,security,security-check,security-check-centralized,tester,ui-design-critique,ux-researcher,design-advisor,ui-designer,memory}
"
```

### Step 12: 同步 AGENTS.md（从模板机 rsync）
```bash
# 从本机推送到目标机
TARGET_IP=<IP>
# 子 Agent
for a in qa security security-check security-check-centralized tester ui-design-critique ux-researcher design-advisor ui-designer; do
  cat ~/.openclaw/workspace/subagents/$a/AGENTS.md | \
    ssh ubuntu@$TARGET_IP "cat > ~/.openclaw/workspace/$a/AGENTS.md"
done

# 主 AGENTS.md（注意替换 team ID 和标题）
cat ~/.openclaw/workspace/team3/AGENTS.md | \
  sed 's/team3/<TEAM_ID>/g; s/管理 5 人团队/管理团队/g; s/43\.156\.50\.6/<TEAM_SERVER_IP>/g' | \
  ssh ubuntu@$TARGET_IP "cat > ~/.openclaw/workspace/AGENTS.md"
```

### Step 13: 写入 config.json
```bash
ssh ubuntu@<TARGET_IP> "python3 << 'PYEOF'
import json, os
CFG = os.path.expanduser('~/.openclaw/openclaw.json')
data = {'agents':{'defaults':{},'list':[]},'gateway':{},'models':{'providers':{}}}
try:
    with open(CFG) as f:
        data = json.load(f)
except FileNotFoundError:
    pass

data['agents']['list'] = [
    {'id':'<TEAM_ID>','workspace':'workspace','description':'<PROJECT>主代理'},
    {'id':'qa','workspace':'workspace/qa','description':'L1+L2'},
    {'id':'security','workspace':'workspace/security','description':'L3 SCSVS'},
    {'id':'security-check','workspace':'workspace/security-check','description':'合约扫描'},
    {'id':'security-check-centralized','workspace':'workspace/security-check-centralized','description':'中心化扫描'},
    {'id':'tester','workspace':'workspace/tester','description':'测试验证'},
    {'id':'ui-design-critique','workspace':'workspace/ui-design-critique','description':'设计评审'},
    {'id':'ux-researcher','workspace':'workspace/ux-researcher','description':'UX研究'},
    {'id':'design-advisor','workspace':'workspace/design-advisor','description':'设计灵感'},
    {'id':'ui-designer','workspace':'workspace/ui-designer','description':'UI设计'},
]
data['agents']['defaults'].update({
    'contextInjection':'always',
    'skipOptionalBootstrapFiles':['SOUL.md','HEARTBEAT.md','IDENTITY.md','USER.md'],
    'workspace':'workspace',
})
data['gateway'].update({'bind':'lan','mode':'local'})
data['models']['providers']['deepseek'] = {
    'baseUrl':'https://api.deepseek.com/v1',
    'apiKey':'sk-xxx',
    'api':'openai-completions',
    'models':[{'id':'deepseek-v4-flash','name':'DeepSeek V4 Flash'},{'id':'deepseek-v4-pro','name':'DeepSeek V4 Pro'}],
    'timeoutSeconds':300,
}
os.makedirs(os.path.dirname(CFG), exist_ok=True)
with open(CFG,'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('config written')
PYEOF"
```

### Step 14: 安装安全工具
```bash
ssh ubuntu@<TARGET_IP> 'bash -s' << 'INSTALL_SCRIPT'
export PATH="$HOME/.cargo/bin:$HOME/.foundry/bin:$HOME/.nvm/versions/node/*/bin:$HOME/.local/bin:/snap/bin:/usr/local/bin:$HOME/go/bin:$PATH"

# Node 工具
npm install -g eslint solhint 2>&1 | tail -1

# Python 工具
pip3 install --break-system-packages bandit 2>&1 | tail -1

# 系统工具
sudo apt-get install -y nikto lynis nmap 2>&1 | tail -1

# echidna (release binary, NOT cargo install)
curl -sL --connect-timeout 30 -o /tmp/echidna.tar.gz \
  https://github.com/crytic/echidna/releases/download/v2.3.2/echidna-2.3.2-x86_64-linux.tar.gz
tar xzf /tmp/echidna.tar.gz -C /tmp && sudo mv /tmp/echidna /usr/local/bin/

# gitleaks
curl -sL --connect-timeout 30 -o /tmp/gl.tar.gz \
  https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_*_linux_x64.tar.gz
tar xzf /tmp/gl.tar.gz -C /tmp && sudo mv /tmp/gitleaks /usr/local/bin/

# trivy
curl -sL --connect-timeout 30 -o /tmp/trivy.tar.gz \
  https://github.com/aquasecurity/trivy/releases/latest/download/trivy_*_Linux-64bit.tar.gz
tar xzf /tmp/trivy.tar.gz -C /tmp && sudo mv /tmp/trivy /usr/local/bin/

# slither + aderyn + mythril
pip3 install --break-system-packages slither-analyzer 2>&1 | tail -1
cargo install aderyn 2>&1 | tail -1
pip3 install --break-system-packages mythril 2>&1 | tail -1

# foundry
curl -L https://foundry.paradigm.xyz | bash 2>&1 | tail -1 && foundryup 2>&1 | tail -2

# nuclei
curl -sL --connect-timeout 30 -o /tmp/nuclei.zip \
  https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_*_linux_amd64.zip
unzip -o /tmp/nuclei.zip -d /tmp && sudo mv /tmp/nuclei /usr/local/bin/

# autotest
git clone --depth 1 git@github.com:sftgroup/autotest.git ~/.openclaw/workspace/autotest 2>&1 | tail -1
sudo cp ~/.openclaw/workspace/autotest/autotest.sh /usr/local/bin/autotest && sudo chmod +x /usr/local/bin/autotest
INSTALL_SCRIPT
```

### Step 15: 重启 Gateway
```bash
ssh ubuntu@<TARGET_IP> "
  # 确保完全停止
  pkill -f 'openclaw.*gateway' 2>/dev/null
  sleep 3

  # 启动
  systemctl --user enable openclaw-gateway 2>/dev/null
  systemctl --user restart openclaw-gateway
  sleep 8

  # 验证
  ss -tlnp | grep node | head -1 && echo 'UP' || echo 'DOWN'
"
```

### Step 16: 最终验证
```bash
ssh ubuntu@<TARGET_IP> "
  echo '=== 验证 ==='
  echo -n '主 AGENTS: ' && head -1 ~/.openclaw/workspace/AGENTS.md
  echo -n 'agents: ' && python3 -c \"import json;c=json.load(open('~/.openclaw/openclaw.json'));print(len(c['agents']['list']))\"
  echo -n 'bind: ' && python3 -c \"import json;c=json.load(open('~/.openclaw/openclaw.json'));print(c['gateway']['bind'])\"
  echo -n 'ctxInj: ' && python3 -c \"import json;c=json.load(open('~/.openclaw/openclaw.json'));print(c['agents']['defaults']['contextInjection'])\"
  echo -n 'Gateway: ' && ss -tlnp | grep node | grep -oP '0\.0\.0\.0:\d+'
"
```

---

## 五、常见问题速查

| 问题 | 原因 | 解决 |
|------|------|------|
| agent 列表只有自己 | `workspace` 用了绝对路径 | 改为相对路径 |
| `Unknown model: deepseek/v4-pro` | deepseek provider 缺 apiKey/models | 补全 provider 配置 |
| 文件 Not Found (ENOENT) | workspace 解析到了错误 HOME | 检查 `agents.defaults.workspace` 和进程 HOME 一致性 |
| Gateway 重启后配置丢失 | kill 时内存写回覆盖了文件 | 先停 Gateway 再改 config，不用 kill -9 |
| 子 agent 看不到 | config 改了但 Agent Registry 未重建 | 完整 restart（systemctl stop → start） |
| 同时有 workspaces/ 和 workspace/ | 新旧两套目录并存 | 删 workspaces/，只留 workspace/ |

---

## 六、坑与教训

1. **workspace 路径必须相对** — OpenClaw 以实际 HOME 为基准拼接相对路径
2. **改 config 前停 Gateway** — 进程内存状态会写回，覆盖手动修改
3. **root vs ubuntu 用户** — 确认运行用户后再操作，避免建两套
4. **echidna 不能 cargo install** — 是 library-only crate，用 GitHub release binary
5. **gitleaks/trivy 新版本** — 路径用 `x64` 而非 `amd64`
6. **AGENTS.md 不写版本号/安装命令** — 缓存污染，应下沉到子 Agent
7. **systemd service 路径** — `~/.config/systemd/user/openclaw-gateway.service`
8. **禁用自动 compaction** — 将 agent 级 `contextTokens` 设为 2,000,000，compaction 永不自动触发
9. **`agents/` 目录不能删** — 旧版残留 `workspaces/` 才删，`agents/` 是 OpenClaw 运行时存储（含 session 归档）
10. **Browser 清理需要双层** — L1 (chrome-cleanup.sh) + L2 (kill-idle-browser.sh)，防止内存泄漏
11. **autotest 部署后必须 selfcheck** — `autotest selfcheck --project {项目根目录}`，验证报告路径/合约地址/钱包配置正确
12. **autotest 三方审计防线** — security-check (合约扫描) + security (L3审计) + QA (L1+L2审查)，部署前必须全部过
13. **项目类型判断在 spawn 前做** — 架构师根据文件特征判断：含 `contracts/src/*.sol` + `foundry.toml` → 合约项目 → `security-check`；不含 → 中心化项目 → `security-check-centralized`；两者都有 → 两个都 spawn
14. **安全审计分层不可混** — security-check 只管合约扫描（Slither/Aderyn/Echidna），security-check-centralized 只管 Web 扫描（SAST/DAST/SCA），各装各的工具，AGENTS.md 各自精简

---

## 七、QA + 安全审计完整流水线（参考）

> 来源：team4 QA+安全审计完整方案 v1.0

### 项目类型 → 扫描 Agent 路由

| 特征 | 类型 | 扫描 Agent |
|------|------|------------|
| 含 `contracts/src/*.sol` + `foundry.toml` | 合约项目 | `security-check` (Slither/Aderyn/Echidna/Forge) |
| 不含合约文件 | 中心化项目 | `security-check-centralized` (SAST/DAST/SCA/基础设施) |
| 两者都有 | 混合项目 | 两个都 spawn |

### 审计流程 7 步

| Step | 角色 | 任务 |
|------|------|------|
| 1 | 架构师 | 判断项目类型 → 并行 spawn qa + security + 对应 scan agent |
| 2 | 架构师 | 汇总 QA_REPORT + SEC_REVIEW + SEC_SCAN → 判定严重度 |
| 3 | 架构师 | 修复 Critical + High 问题 |
| 4 | 架构师 | 更新到测试服务器 |
| 5 | 架构师 | spawn tester 回归 |
| 6 | 架构师 | 验证修复 + browser 页面 E2E + 链上交易验证 |
| 7 | 架构师 | 更新部署记录 |

### 产出文件

| 报告 | Agent | 内容 |
|------|-------|------|
| `QA_REVIEW_REPORT.md` | qa | 功能完整性 + 代码逻辑 + 测试覆盖 + Bug诊断 |
| `SECURITY_REVIEW_REPORT.md` | security (GLM-5.2) | 威胁建模 + 85项 SCSVS 攻击矩阵 + Immunefi/OWASP 评分 |
| `SECURITY_SCAN_REPORT.md` | scan agent | SAST + DAST + SCA + 基础设施全扫描结果 |

### 严重度对齐

| 级别 | 合约 (Immunefi) | 中心化 (OWASP) | 响应 |
|------|--------|--------|------|
| 🔴 Critical | 资金损失 ≥$100K / 权限完全绕过 | RCE/SQL注入/数据泄露 | 🚨 立即修复 |
| 🟠 High | 单点攻破后大量损失 | XSS/CSRF/SSRF/权限绕过 | 🔴 24h 内 |
| 🟡 Medium | 特定条件组合攻击 | 配置缺陷/信息泄露 | 🟠 本次迭代 |
| 🟢 Low | 最佳实践改进 | 安全头/Cookie 最佳实践 | 🟡 技术债 |

### Spawn 模板速查

```
# security-check (合约)
agentId="security-check", taskName="sc1-static"
task="代码路径: {项目根目录}/contracts/src/ | SC-1→SC-2→SC-3 分步写入"

# security-check-centralized (中心化)
agentId="security-check-centralized", taskName="csc1-sast"
task="目标: {TARGET_IP}:{PORT} | CSC-1→CSC-2→CSC-3 分步写入"

# security (L3 深度审查, GLM-5.2)
agentId="security", taskName="sec1-threat"
task="SEC-1: 威胁建模 → SEC-2: 钱流+攻击矩阵 → SEC-3: 签名+跨链+升级"
```

---

*版本 v2.1 | 2026-07-09*
*融合文档: Qdrant 记忆共享方案 v3.0 + 系统自动维护机制 + autotest v1.4 + QA+安全审计完整方案 v1.0*
