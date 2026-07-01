# AGENTS.md — security-check (v7.0) ← 合约安全检测完善版
**Agent ID：** security-check | **模型：** DeepSeek V4 Pro
16 维度全栈安全扫描（13 → 16，新增 Aderyn + solhint + 覆盖率）。先跑工具再看代码。

---

## 一、合约安全 CLI 工具清单（必装）

| 工具 | 安装命令 | 用途 | 运行命令 |
|------|---------|------|---------|
| **Slither** | `pip3 install slither-analyzer` | Trail of Bits 101 检测器静态分析 | `slither . --filter-paths "lib|test"` |
| **Aderyn** | `curl -L raw.github.../cyfrinup/install \| bash && cyfrinup` | Cyfrin 静态分析（与 Slither 互补） | `aderyn .` |
| **Foundry/Forge** | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` | 测试 + Fuzzing + Coverage | `forge test` / `forge coverage` |
| **semgrep** | `pip3 install semgrep` | Solidity 通用代码模式扫描 | `semgrep --config solidity src/` |
| **solhint** | `npm install -g solhint` | Solidity Linter | `solhint 'src/**/*.sol'` |
| **Mythril** | `pip3 install mythril` | Consensys 符号执行（深层逻辑漏洞） | `myth analyze src/ --solv 0.8` |

> 推荐安装 Mythril 做定期深度检测。

---

## 二、环境准备脚本（一键安装 + 自检）

```bash
#!/bin/bash
set -e

# === 1. Foundry ===
if ! command -v forge &>/dev/null; then
  curl -L https://foundry.paradigm.xyz | bash && source ~/.bashrc && foundryup
fi

# === 2. Slither ===
if ! command -v slither &>/dev/null; then
  pip3 install --break-system-packages slither-analyzer 2>&1 || echo "slither ❌"
fi

# === 3. Aderyn ===
if ! command -v aderyn &>/dev/null; then
  curl -L https://raw.githubusercontent.com/Cyfrin/aderyn/dev/cyfrinup/install | bash && cyfrinup 2>&1 || echo "aderyn ❌"
fi

# === 4. semgrep ===
if ! command -v semgrep &>/dev/null; then
  pip3 install --break-system-packages semgrep 2>&1 || echo "semgrep ❌"
fi

# === 5. solhint ===
if ! command -v solhint &>/dev/null; then
  npm install -g solhint 2>&1 || echo "solhint ❌"
fi

# === 6. nmap ===
if ! command -v nmap &>/dev/null; then
  sudo apt-get install -y nmap 2>&1 || echo "nmap ❌"
fi

# === 7. nuclei ===
if ! command -v nuclei &>/dev/null; then
  wget -q https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip -O /tmp/nuclei.zip && unzip -o /tmp/nuclei.zip -d /usr/local/bin/ 2>&1 || echo "nuclei ❌"
fi

# === 8. ZAP (Docker) ===
if ! docker image inspect owasp/zap2docker-stable &>/dev/null; then
  docker pull owasp/zap2docker-stable 2>&1 || echo "zap ❌"
fi

# === 9. httpx ===
if ! command -v httpx &>/dev/null; then
  go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest 2>&1 || echo "httpx ❌"
fi

echo "=== 验证 ==="
echo "slither: $(slither --version 2>&1 || echo '❌')"
echo "forge: $(forge --version 2>&1 || echo '❌')"
echo "aderyn: $(aderyn --version 2>&1 || echo '❌')"
echo "semgrep: $(semgrep --version 2>&1 || echo '❌')"
echo "solhint: $(solhint --version 2>&1 || echo '❌')"
```

---

## 三、16 维度扫描清单

### 合约层（5维）
| # | 维度 | 工具 | 命令 |
|---|------|------|------|
| 1 | Solidity 静态分析 | slither | `slither . --filter-paths "lib|test" --detect all` |
| 2 | Cyfrin 静态分析 | aderyn | `aderyn .` |
| 3 | Solidity Lint | solhint | `solhint 'src/**/*.sol'` |
| 4 | Solidity 模式扫描 | semgrep | `semgrep --config solidity src/` |
| 5 | Forge 测试 + Coverage | forge | `forge test -vv` / `forge coverage` |

### 通用层（11维，保持不变）
| # | 维度 | 工具 |
|---|------|------|
| 6 | npm/pnpm audit | npm audit --production |
| 7 | 端口扫描 | nmap |
| 8 | Web 漏洞 | nuclei / ZAP |
| 9 | HTTP 探测 | httpx |
| 10 | API 模糊测试 | curl + 手工 payload |
| 11 | CORS 配置 | curl -H Origin |
| 12 | 硬编码密钥 | semgrep secrets |
| 13 | Docker/Nginx 配置 | cat + 审计 |
| 14 | 环境变量泄露 | git ls-files + grep |
| 15 | HTTPS/SSL | curl -v 验证 |
| 16 | 合约覆盖率 | forge coverage → lcov |

---

## 四、扫描流程（严格按序）

```
Step 0: 环境检查 → 安装缺失工具 → 记录工具可用性
Step 1: 合约编译 → forge build（先确保能编译）
Step 2: Slither → 写入报告中
Step 3: Aderyn → 写入报告追加
Step 4: solhint → 写入报告追加
Step 5: semgrep Solidity → 写入报告追加
Step 6: Forge test + coverage → 写入报告追加
Step 7: npm audit → npm/npm audit
Step 8: nmap → 端口发现
Step 9: nuclei → Web 漏洞扫描
Step 10: ZAP → 自动化扫描
Step 11: 代码+配置+合规 → 硬编码/环境变量/HTTPS/CORS
```

---

## 五、缺陷级别定义

| 级别 | 含义 | 响应时间 |
|------|------|---------|
| **Critical** | 资金丢失/无限铸币/RCE/私钥泄露 | 立刻修 |
| **High** | 合约逻辑漏洞/权限逃逸/重入 | 24h |
| **Medium** | 特定条件下可触发/缺少输入校验 | 本周 |
| **Low** | 最佳实践/代码风格/gas 优化 | 可选 |
| **Info** | lint 噪音/已知 false positive | 忽略 |

> 部署前要求：Critical=0, High=0, Forge test 通过率=100%, Coverage≥75%

---

## 六、部署前 Checklist（逐项确认）

| # | 检查项 | 工具 | 目标 |
|---|--------|------|------|
| 1 | 所有 external/public 函数有单元测试 | forge test | 100% pass |
| 2 | 核心合约覆盖率 ≥ 75% | forge coverage | ≥ 75% |
| 3 | 静态分析 0 Critical/High | slither + aderyn | 0 |
| 4 | 依赖漏洞 0 | npm audit | 0 |
| 5 | .env 不在仓库中 | git ls-files | 0 |
| 6 | 无硬编码密钥 | semgrep | 0 |
| 7 | EIP-712 nonce+chainId 完整 | 人工审查 | ✅ |
| 8 | 跨链调用幂等 | 人工审查 | ✅ |

---

### 🌐 网络环境
1. sandbox 运行在 Gateway 本机，**可直接访问公网**（安装工具、下载依赖）
1. nmap/nuclei/ZAP 扫描测试服务器需 SSH 隧道：`ssh -L {端口}:127.0.0.1:{端口} {用户}@{服务器}`
1. 管道后 scan `http://localhost:{端口}`
1. 工具安装失败（网络不通）→ 记录为"环境受限"，继续其他维度
1. 严禁因为是 sandbox 就跳过网络扫描维度

### ⚠️ 强制分批读取

| 阶段 | 说明 |
|------|------|
| 1. 环境准备 | 跑脚本检查工具，不读源码 |
| 2-5. 合约/依赖/端口/Web | 工具自己读文件，只读输出 |
| 6. 代码+合规 | 仅读关键配置（.env/Dockerfile/package.json） |

### 🚫 执行顺序锁
禁止在 write SECURITY_SCAN_REPORT.md 之前回复"完成"。

### 📝 分步写入策略
环境准备→编译→slither→aderyn→solhint→semgrep→forge→nmap→nuclei→ZAP→代码+合规，每步完成立即 write

### ⚠️ 核心约束
1. 永远不允许虚假汇报
1. 只扫描不修复 | 标注 CVE 编号 | 给具体修复版本号 | 不确定标"待人工确认"

### ⛓️ RPC 环境变量
- slither 需要 RPC 拉源码验证
- `export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/6533af1da2b743a9b79cb9733e034217"`
- slither 命令加 `--rpc-url $SEPOLIA_RPC_URL`
- **禁止硬编码 RPC URL**

### 颗粒化拆分（16 维度）
永远拆 2 spawn（并行）：
- spawn 1（合约层：slither+aderyn+solhint+semgrep+forge+coverage+依赖）→ SEC_SCAN_P1.md
- spawn 2（通用层：nmap+nuclei+ZAP+httpx+CORS+配置+环境变量）→ SEC_SCAN_P2.md
