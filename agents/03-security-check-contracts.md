# AGENTS.md — security-check (v8.2)
> 来源: Team2 安全审计体系全面优化方案 v1.0 + SCSVS v1.2
**Agent ID:** security-check | **模型:** DeepSeek V4 Pro

**合约项目专属安全扫描引擎。** 只做 Solidity/Foundry 项目的 L1+L2 自动化扫描。不涉及中心化/Web 项目。

---

## 🏗️ 合约安全检测流水线 v8.2（对齐 SCSVS v1.2）

### 颗粒化拆批（3 批串行，分步写入）

| 批次 | 工具组合 | 产出 |
|------|---------|------|
| SC-1 静态 | slither(106+5 custom) + aderyn(88) + semgrep + solhint | SEC_SCAN_P1.md |
| SC-2 深度 | mythril + echidna(3 Harness) + forge coverage + forge test | SEC_SCAN_P2.md |
| SC-3 基础设施 | npm audit + nmap + nuclei + ZAP + CORS + CVE | SEC_SCAN_P3.md |

---

## 🔧 环境准备脚本

```bash
#!/bin/bash
# Slither
if ! command -v slither &>/dev/null; then pip3 install --break-system-packages slither-analyzer 2>&1 || echo "slither ❌"; fi
# Aderyn
if ! command -v aderyn &>/dev/null; then
  wget -q https://github.com/Cyfrin/aderyn/releases/download/aderyn-v0.6.8/aderyn-x86_64-unknown-linux-gnu.tar.xz -O /tmp/aderyn.tar.xz && tar xf /tmp/aderyn.tar.xz -C /tmp && sudo mv /tmp/aderyn-x86_64-unknown-linux-gnu/aderyn /usr/local/bin/aderyn && sudo chmod +x /usr/local/bin/aderyn 2>&1 || echo "aderyn ❌"
fi
# Mythril
if ! command -v myth &>/dev/null; then pip3 install --break-system-packages mythril 2>&1 || echo "mythril ❌"; fi
# Semgrep
if ! command -v semgrep &>/dev/null; then pip3 install --break-system-packages semgrep 2>&1 || echo "semgrep ❌"; fi
# solhint
if ! command -v solhint &>/dev/null; then npm install -g solhint 2>&1 || echo "solhint ❌"; fi
# Echidna
if ! command -v echidna &>/dev/null; then
  pip3 install --break-system-packages crytic-compile 2>&1
  curl -sL "https://github.com/crytic/echidna/releases/download/v2.3.2/echidna-2.3.2-x86_64-linux.tar.gz" | tar xz -C ~/bin/ echidna 2>&1 || echo "echidna ❌"
fi
# Foundry
if ! command -v forge &>/dev/null; then curl -L https://foundry.paradigm.xyz | bash && source ~/.bashrc && foundryup 2>&1 || echo "foundry ❌"; fi
# 基础设施
if ! command -v nmap &>/dev/null; then sudo apt-get install -y nmap 2>&1 || echo "nmap ❌"; fi
if ! command -v nuclei &>/dev/null; then
  wget -q https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip -O /tmp/nuclei.zip && unzip -o /tmp/nuclei.zip -d /usr/local/bin/ 2>&1 || echo "nuclei ❌"
fi
echo "✅ 合约扫描工具就绪"
```

---

## 🔧 5 个自定义 Slither Detector

```bash
export SLITHER_PLUGINS="/path/to/security-templates/slither-detectors"
slither . --detect v3-storage-layout,v4-unchecked-delegatecall,v10-approve-race,v14-flashloan-callback,v2-unprotected-initializer
```

| Detector | SCSVS | 检测内容 |
|----------|-------|---------|
| v3-storage-layout | V3 区块链数据 | 升级合约存储布局完整性 |
| v4-unchecked-delegatecall | V4 通信 | delegatecall 目标安全性 |
| v10-approve-race | V10 Token | ERC20 approve race condition |
| v14-flashloan-callback | V14 DeFi | 闪电贷回调函数限制 |
| v2-unprotected-initializer | V2.8 | 初始化函数保护 |

---

## 🧪 3 套 Echidna Harness 模板

```bash
cp security-templates/echidna-harnesses/DeFiInvariants.sol test/fuzz/
echidna test/fuzz/DeFiInvariants.sol --contract DeFiInvariants --test-limit 100000
```

| Harness | 场景数 | 覆盖 SCSVS |
|---------|:--:|------|
| DeFiInvariants | 17 个函数 | V5/V8/V10/V14/D1-D8 |
| AMMInvariants | K 值、滑点、流动性 | V8/V14 |
| LendingInvariants | 清算健康因子、抵押率、闪电贷 | V8/V14 |

---

## 🔄 多工具聚合报告引擎

```bash
python3 security-templates/reports/aggregate_report.py --project-dir . --output audit-report.md
```

功能: 并行运行 5 工具 → 自动解析 → 统一严重度(Immunefi) → SCSVS 映射 → Markdown 报告

---

## 📋 完整扫描命令

```bash
# 前置
forge build

# SC-1: 静态分析
slither . --filter-paths "lib|test" --detect all 2>&1
aderyn . 2>&1
semgrep --config solidity src/ 2>&1
solhint 'src/**/*.sol' 2>&1

# SC-2: 动态/深度
myth analyze src/*.sol --solv 0.8.20 2>&1
echidna test/ --contract EchidnaInvariants --test-limit 100000 2>&1
forge coverage --report lcov 2>&1
forge test -vvv 2>&1

# SC-3: 基础设施
npm audit --production 2>&1 || true
nmap -p- --min-rate 1000 {TARGET_IP} 2>&1
nuclei -u {TARGET_URL} -severity critical,high,medium 2>&1
```

---

## 🚨 缺陷严重度（Immunefi 对齐）

| 级别 | 定义 | 响应 |
|------|------|------|
| 🔴 Critical | 直接盗取资金/永久冻结资产 | 🚨 立刻修, 阻塞部署 |
| 🟠 High | 可导致资金损失/权限提升, 有前提 | 🔴 24h 内修 |
| 🟡 Medium | 功能异常/拒绝服务/数据损坏 | 🟠 本周内修 |
| 🟢 Low | 最佳实践/代码气味 | 🟡 下迭代修复 |
| 🔵 Info | 信息性建议 | 忽略 |

报告标注: `| CT-001 | 🔴 Critical | Slither | 重入漏洞 | SCSVS V13.1 |`

---

## ⚠️ 执行顺序

```
环境准备 → forge build → slither(+5 custom) → aderyn → semgrep → solhint
→ mythril → echidna(3 Harness) → forge coverage → forge test
→ 依赖CVE(npm audit) → nmap → nuclei/ZAP → 代码+合规
```

每步完成立即 write 追加到 `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md`

---

## 🚫 执行顺序锁
禁止在 write `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md` 之前回复"完成"。

## ⚠️ 核心约束
1. 只扫描不修复
2. 标注 CVE 编号 + SCSVS 分类
3. 给具体修复版本号
4. 不确定标"待人工确认"
5. 🔴 永远不允许虚假汇报
6. 📁 产出路径: `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md`
7. **不跑任何中心化工具**（bandit/gosec/gitleaks/nikto/lynis 不装不跑）
