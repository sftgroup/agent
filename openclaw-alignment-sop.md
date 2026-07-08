# OpenClaw 多机对齐标准化方案 v1.0

## 目标

将任意数量 OpenClaw 实例统一到相同基线，实现主 Agent + 子 Agent + 配置 + 安全工具全量对齐。

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

### Step 2: 诊断现有配置
```bash
ssh ubuntu@<TARGET_IP> "
  echo '=== 主 AGENTS.md ==='
  head -1 ~/.openclaw/workspace/AGENTS.md 2>/dev/null
  wc -l ~/.openclaw/workspace/AGENTS.md 2>/dev/null

  echo '=== 子 Agent ==='
  for d in qa security security-check security-check-centralized tester \
    ui-design-critique ux-researcher design-advisor ui-designer; do
    f=~/.openclaw/workspace/\$d/AGENTS.md
    [ -f \"\$f\" ] && echo \"\$d: \$(wc -l < \"\$f\")L\" || echo \"\$d: MISSING\"
  done

  echo '=== config.json ==='
  python3 -c '
import json
c = json.load(open(\"/home/ubuntu/.openclaw/openclaw.json\"))
for a in c[\"agents\"][\"list\"]:
    print(a[\"id\"], a.get(\"workspace\",\"?\"))
d = c[\"agents\"][\"defaults\"]
print(\"ctxInj:\", d.get(\"contextInjection\",\"?\"))
print(\"bind:\", c[\"gateway\"].get(\"bind\",\"?\"))
'

  echo '=== 旧版残留 ==='
  ls -d ~/.openclaw/workspaces 2>/dev/null && echo '❌ workspaces/' || echo '✅ clean'
  ls -d ~/.openclaw/agents 2>/dev/null && echo '❌ agents/' || echo '✅ clean'

  echo '=== 安全工具 ==='
  export PATH=\"\$HOME/.cargo/bin:\$HOME/.foundry/bin:\$HOME/.nvm/versions/node/*/bin:\$HOME/.local/bin:/usr/local/bin:\$HOME/go/bin:\$PATH\"
  for t in forge slither aderyn semgrep solhint echidna bandit nmap nuclei nikto eslint lynis gitleaks trivy autotest; do
    which \"\$t\" >/dev/null 2>&1 && echo \"✅ \$t\" || echo \"❌ \$t\"
  done
"
```

---

## 三、执行对齐

### Step 3: 停 Gateway
```bash
ssh ubuntu@<TARGET_IP> "
  systemctl --user stop openclaw-gateway 2>/dev/null
  pkill -f 'openclaw.*gateway' 2>/dev/null
  sleep 3
  ps aux | grep '[o]penclaw.*gateway' | grep -v grep && echo 'STILL RUNNING' || echo 'stopped'
"
```

### Step 4: 创建/清理目录
```bash
ssh ubuntu@<TARGET_IP> "
  rm -rf ~/.openclaw/workspaces ~/.openclaw/agents  # 清旧版残留
  mkdir -p ~/.openclaw/workspace/{qa,security,security-check,security-check-centralized,tester,ui-design-critique,ux-researcher,design-advisor,ui-designer,memory}
"
```

### Step 5: 同步 AGENTS.md（从模板机 rsync）
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

### Step 6: 写入 config.json
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

### Step 7: 安装安全工具
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

### Step 8: 重启 Gateway
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

### Step 9: 最终验证
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

## 四、常见问题速查

| 问题 | 原因 | 解决 |
|------|------|------|
| agent 列表只有自己 | `workspace` 用了绝对路径 | 改为相对路径 |
| `Unknown model: deepseek/v4-pro` | deepseek provider 缺 apiKey/models | 补全 provider 配置 |
| 文件 Not Found (ENOENT) | workspace 解析到了错误 HOME | 检查 `agents.defaults.workspace` 和进程 HOME 一致性 |
| Gateway 重启后配置丢失 | kill 时内存写回覆盖了文件 | 先停 Gateway 再改 config，不用 kill -9 |
| 子 agent 看不到 | config 改了但 Agent Registry 未重建 | 完整 restart（systemctl stop → start） |
| 同时有 workspaces/ 和 workspace/ | 新旧两套目录并存 | 删 workspaces/，只留 workspace/ |

---

## 五、坑与教训

1. **workspace 路径必须相对** — OpenClaw 以实际 HOME 为基准拼接相对路径
2. **改 config 前停 Gateway** — 进程内存状态会写回，覆盖手动修改
3. **root vs ubuntu 用户** — 确认运行用户后再操作，避免建两套
4. **echidna 不能 cargo install** — 是 library-only crate，用 GitHub release binary
5. **gitleaks/trivy 新版本** — 路径用 `x64` 而非 `amd64`
6. **AGENTS.md 不写版本号/安装命令** — 缓存污染，应下沉到子 Agent
7. **systemd service 路径** — `~/.config/systemd/user/openclaw-gateway.service`
