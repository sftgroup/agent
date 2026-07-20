# SECURITY_SCAN_REPORT — 合约项目安全扫描报告

> **模板版本**: v1.0 | **使用 Agent**: security-check | **模型**: DeepSeek V4 Pro
> **触发条件**: 项目含 `contracts/src/*.sol` + `foundry.toml`

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 扫描日期 | `{YYYY-MM-DD}` |
| Commit Hash | `{COMMIT_HASH}` |
| 合约代码路径 | `{PROJECT_ROOT}/contracts/src/` |
| 报告路径 | `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md` |

---

## 1. SC-1: L1 静态分析 (SAST)

### 1.1 Slither — 106 内置 + 5 自定义检测器

#### Slither 执行命令
```bash
slither {PROJECT_ROOT} --print human-summary --filter-paths "test|script"
```

#### 发现列表

| # | 检测器 ID | 描述 | SCSVS 映射 | 文件:行号 | 严重度 | 置信度 | 修复建议 |
|---|---|---|---|---|---|---|---|
| S-01 | `{detector}` | `{description}` | `{scsvs_ref}` | `{file}:{line}` | `{severity}` | `{confidence}` | `{fix}` |

#### 自定义检测器发现

| # | 检测器 | 描述 | SCSVS | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|---|
| CS-01 | `v2-unprotected-initializer` | — | V1.13 | — | — | — |
| CS-02 | `v3-storage-layout` | — | V1.3 | — | — | — |
| CS-03 | `v4-unchecked-delegatecall` | — | V2.10 | — | — | — |
| CS-04 | `v10-approve-race` | — | V10.1 | — | — | — |
| CS-05 | `v14-flashloan-callback` | — | V14.10 | — | — | — |

### 1.2 Aderyn — 88 检测器

#### Aderyn 执行命令
```bash
aderyn {PROJECT_ROOT}
```

#### 发现列表

| # | 规则 ID | 描述 | SCSVS 映射 | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|---|
| A-01 | `{rule_id}` | `{description}` | `{scsvs_ref}` | `{file}:{line}` | `{severity}` | `{fix}` |

### 1.3 Semgrep — Solidity 规则

#### Semgrep 执行命令
```bash
semgrep --config=solidity {PROJECT_ROOT}/contracts/
```

#### 发现列表

| # | 规则 ID | 描述 | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| SM-01 | `{rule}` | `{description}` | `{file}:{line}` | `{severity}` | `{fix}` |

### 1.4 Solhint — Solidity Linter

#### Solhint 执行命令
```bash
solhint "contracts/**/*.sol"
```

#### 发现列表

| # | 规则 ID | 描述 | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| SH-01 | `{rule}` | `{description}` | `{file}:{line}` | `{severity}` | `{fix}` |

---

## 2. SC-2: L2 动态分析 (DAST + Fuzzing)

### 2.1 Mythril — 符号执行

#### Mythril 执行命令
```bash
myth analyze {PROJECT_ROOT}/contracts/ --solc-json {PROJECT_ROOT}/remappings.txt --execution-timeout 300
```

#### 发现列表

| # | 漏洞类型 | SWC ID | 描述 | 文件:行号 | 严重度 | 交易序列 | 修复建议 |
|---|---|---|---|---|---|---|---|
| M-01 | `{vuln_type}` | `{swc}` | `{description}` | `{file}:{line}` | `{severity}` | `{tx_sequence}` | `{fix}` |

### 2.2 Echidna — DeFi Fuzzing (3 Harness)

#### Echidna 执行命令
```bash
# Harness 1: DeFiInvariants (17 场景)
echidna {PROJECT_ROOT} --contract DeFiInvariants --test-limit 100000 --corpus-dir corpus/defi/

# Harness 2: AMMInvariants (K值/滑点/流动性)
echidna {PROJECT_ROOT} --contract AMMInvariants --test-limit 100000 --corpus-dir corpus/amm/

# Harness 3: LendingInvariants (清算/抵押率/闪电贷)
echidna {PROJECT_ROOT} --contract LendingInvariants --test-limit 100000 --corpus-dir corpus/lending/
```

#### 结果矩阵

| Harness | 场景数 | 测试数 | 失败 | 时间 | 不变性破坏 | 严重度 | 覆盖 SCSVS |
|---|---|---|---|---|---|---|---|
| DeFiInvariants | 17 | `{n}` | `{n}` | `{time}` | `{violations}` | — | V5/V8/V10/V14/D1-D8 |
| AMMInvariants | `{n}` | `{n}` | `{n}` | `{time}` | `{violations}` | — | V8/V14 |
| LendingInvariants | `{n}` | `{n}` | `{n}` | `{time}` | `{violations}` | — | V8/V14 |

#### 不变性破坏细节

| # | Harness | 不变量 | 破坏输入 | 文件:行号 | 严重度 | SCSVS |
|---|---|---|---|---|---|---|
| E-01 | `{harness}` | `{invariant}` | `{breaking_input}` | `{file}:{line}` | `{severity}` | `{scsvs}` |

### 2.3 Foundry 测试

#### 命令
```bash
forge test --match-path "test/**/*.t.sol" -vvv
```

#### 测试结果

| 测试文件 | 总测 | 通过 | 失败 | 覆盖率行% | 覆盖率分支% |
|---|---|---|---|---|---|
| `{test_file}` | `{total}` | `{pass}` | `{fail}` | `{line_pct}` | `{branch_pct}` |

---

## 3. SC-3: 基础设施 + SCA 扫描

### 3.1 npm audit (依赖 CVE)

```bash
npm audit --audit-level=high
```

| # | 包名 | CVE | 严重度 | 当前版本 | 修复版本 | 修复建议 |
|---|---|---|---|---|---|---|
| NA-01 | `{pkg}` | `{cve}` | `{severity}` | `{current}` | `{fixed}` | `{fix}` |

### 3.2 Trivy — 全面扫描

```bash
trivy fs --scanners vuln,secret,misconfig {PROJECT_ROOT}
```

| # | 扫描器 | 目标 | 发现 | 严重度 | 详情 | 修复建议 |
|---|---|---|---|---|---|---|
| TR-01 | `{scanner}` | `{target}` | `{finding}` | `{severity}` | `{detail}` | `{fix}` |

### 3.3 Nmap — 端口审计

```bash
nmap -sV -sC {TARGET_IP} -p {PORTS}
```

| # | 端口 | 服务 | 版本 | 已知漏洞 | 严重度 | 建议 |
|---|---|---|---|---|---|---|
| NM-01 | `{port}` | `{service}` | `{version}` | `{known_cve}` | `{severity}` | `{suggestion}` |

### 3.4 Nuclei — OWASP 模板

```bash
nuclei -target {TARGET_URL} -t technologies,exposures,misconfigurations
```

| # | 模板 | 严重度 | 匹配 URL | 详情 | 修复建议 |
|---|---|---|---|---|---|
| NU-01 | `{template}` | `{severity}` | `{url}` | `{detail}` | `{fix}` |

### 3.5 ZAP — 主动扫描

```bash
zap-cli quick-scan {TARGET_URL}
```

| # | 告警 | 风险等级 | URL | 参数 | CWE | 详情 |
|---|---|---|---|---|---|---|
| ZP-01 | `{alert}` | `{risk}` | `{url}` | `{param}` | `{cwe}` | `{detail}` |

---

## 4. 统计汇总

### 4.1 按工具

| 工具 | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 总计 |
|---|---|---|---|---|---|
| Slither (内置+自定义) | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Aderyn | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Semgrep | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Solhint | — | — | `{n}` | `{n}` | **{sum}** |
| Mythril | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Echidna | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Foundry 测试 | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| npm audit | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Trivy | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Nmap | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| Nuclei | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| ZAP | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| **总计** | **{sum}** | **{sum}** | **{sum}** | **{sum}** | **{total}** |

### 4.2 按 SCSVS 分类

| CSVS 类别 | Critical | High | Medium | Low | 覆盖项 |
|---|---|---|---|---|---|
| V1 (架构) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/15` |
| V2 (访问控制) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/13` |
| V5 (算术) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/6` |
| V8 (业务逻辑) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/11` |
| V9 (DOS) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/8` |
| V10 (Token) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/6` |
| V13 (已知攻击) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/20+` |
| V14 (DeFi) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/12` |
| D1-D8 (新攻击) | `{n}` | `{n}` | `{n}` | `{n}` | `{n}/8` |

### 4.3 测试覆盖率

| 指标 | 值 | 目标 |
|---|---|---|
| 行覆盖率 | `{line_pct}%` | ≥85% |
| 分支覆盖率 | `{branch_pct}%` | ≥75% |
| 函数覆盖率 | `{fn_pct}%` | ≥90% |

---

## 5. 总体扫描结论

| 指标 | 值 |
|---|---|
| 总发现数 | `{total}` |
| 可部署阻塞 (Critical) | `{n}` |
| 可部署警告 (High) | `{n}` |
| 技术债 (Medium+Low) | `{n}` |
| SCSVS 工具覆盖 | `{pct}%` |
| **是否可以部署** | ✅/⚠️/❌ |

> 报告由 security-check Agent (DeepSeek V4 Pro) 自动生成，架构师请核查后与 SECURITY_REVIEW_REPORT 交叉验证。
