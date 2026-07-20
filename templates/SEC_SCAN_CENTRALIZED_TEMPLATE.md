# SECURITY_SCAN_REPORT — 中心化项目安全扫描报告

> **模板版本**: v1.0 | **使用 Agent**: security-check-centralized | **模型**: DeepSeek V4 Pro
> **触发条件**: 项目不含合约文件（Node.js/React/Python/Go 等）

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 项目语言/框架 | `{LANGUAGES}` |
| 扫描日期 | `{YYYY-MM-DD}` |
| Commit Hash | `{COMMIT_HASH}` |
| 目标 URL/IP | `{TARGET_IP}:{PORT}` |
| 代码路径 | `{PROJECT_ROOT}` |
| 报告路径 | `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT_CENTRALIZED.md` |

---

## 1. CSC-1: SAST 静态代码分析

### 1.1 Semgrep — 多语言通用扫描

```bash
semgrep --config=auto --config="p/owasp-top-ten" --config="p/secrets" {PROJECT_ROOT}
```

| # | 规则 ID | 规则源 | 描述 | OWASP | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|---|---|
| SM-01 | `{rule}` | `{source}` | `{description}` | `{owasp}` | `{file}:{line}` | `{severity}` | `{fix}` |

### 1.2 Bandit — Python 安全扫描 (如适用)

```bash
bandit -r {PROJECT_ROOT} -f json
```

| # | 测试 ID | 描述 | 文件:行号 | 严重度 | 置信度 | 修复建议 |
|---|---|---|---|---|---|---|
| BD-01 | `{test_id}` | `{description}` | `{file}:{line}` | `{severity}` | `{confidence}` | `{fix}` |

### 1.3 Gosec — Go 安全扫描 (如适用)

```bash
gosec -quiet {PROJECT_ROOT}/...
```

| # | 规则 ID | 描述 | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| GS-01 | `{rule}` | `{description}` | `{file}:{line}` | `{severity}` | `{fix}` |

### 1.4 ESLint + plugin-security — JS/TS 安全扫描 (如适用)

```bash
eslint --plugin security {PROJECT_ROOT} --format json
```

| # | 规则 ID | 描述 | 文件:行号 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| EL-01 | `{rule}` | `{description}` | `{file}:{line}` | `{severity}` | `{fix}` |

---

## 2. CSC-1: 密钥泄露扫描

### 2.1 Gitleaks

```bash
gitleaks detect --source {PROJECT_ROOT} --report-format json
```

| # | 规则 ID | 描述 | 文件:行号 | 密钥指纹(截断) | 严重度 | 修复建议 |
|---|---|---|---|---|---|---|
| GL-01 | `{rule}` | `{description}` | `{file}:{line}` | `{fingerprint}` | `{severity}` | 轮换密钥 + .gitignore |

### 2.2 .env / 配置文件检查

| # | 文件 | 敏感项 | 是否在 .gitignore | 严重度 | 建议 |
|---|---|---|---|---|---|
| EN-01 | `{file}` | `{key_name}` | ❌/✅ | `{severity}` | `{fix}` |

---

## 3. CSC-2: DAST 动态应用扫描

### 3.1 Nuclei — OWASP Top 10 模板

```bash
nuclei -target {TARGET_URL} -t technologies,exposures,misconfigurations,cves
```

| # | 模板 ID | 严重度 | 匹配 URL | OWASP | 详情 | 修复建议 |
|---|---|---|---|---|---|---|
| NU-01 | `{template}` | `{severity}` | `{url}` | `{owasp}` | `{detail}` | `{fix}` |

### 3.2 ZAP — 主动安全扫描 (需 Java)

```bash
zap-cli quick-scan --self-contained --spider --ajax-spider {TARGET_URL}
```

| # | 告警 | 风险等级 | CWE | URL | 参数 | 解决方案 |
|---|---|---|---|---|---|---|
| ZP-01 | `{alert}` | `{risk}` | `{cwe}` | `{url}` | `{param}` | `{solution}` |

### 3.3 Nikto — Web 服务器漏洞

```bash
nikto -host {TARGET_URL} -port {PORT}
```

| # | OSVDB | 发现 | 严重度 | 修复建议 |
|---|---|---|---|---|
| NK-01 | `{osvdb}` | `{finding}` | `{severity}` | `{fix}` |

### 3.4 Whatweb — 技术栈指纹

```bash
whatweb {TARGET_URL}
```

| # | 技术 | 版本 | 最新版本 | 已知 CVE | 建议 |
|---|---|---|---|---|---|
| WW-01 | `{tech}` | `{version}` | `{latest}` | `{cve_list}` | `{suggestion}` |

### 3.5 ffuf — API 模糊测试

```bash
ffuf -w /usr/share/wordlists/dirb/common.txt -u {TARGET_URL}/FUZZ -mc 200,301,403
```

| # | 路径 | 状态码 | 内容长度 | 风险 | 建议 |
|---|---|---|---|---|---|
| FF-01 | `{path}` | `{status}` | `{length}` | `{risk}` | `{suggestion}` |

---

## 4. CSC-2: SCA 依赖组件分析

### 4.1 npm / pip / cargo audit

```bash
# Node.js
npm audit --audit-level=high
# Python
pip-audit
# Rust
cargo audit
```

| # | 包管理器 | 包名 | CVE | 严重度 | 当前版本 | 修复版本 | 修复建议 |
|---|---|---|---|---|---|---|---|
| AU-01 | `{mgr}` | `{pkg}` | `{cve}` | `{severity}` | `{current}` | `{fixed}` | `{fix}` |

### 4.2 Trivy — 全面 SCA

```bash
trivy fs --scanners vuln,secret,misconfig {PROJECT_ROOT}
```

| # | 扫描器 | 目标 | 发现 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| TR-01 | `vuln/secret/misconfig` | `{target}` | `{finding}` | `{severity}` | `{fix}` |

---

## 5. CSC-3: 基础设施安全

### 5.1 Nmap — 端口 & 服务审计

```bash
nmap -sV -sC --script vuln {TARGET_IP}
```

| # | 端口 | 服务 | 版本 | 已知 CVE | 严重度 | 建议 |
|---|---|---|---|---|---|---|
| NM-01 | `{port}` | `{service}` | `{version}` | `{cve}` | `{severity}` | `{suggestion}` |

### 5.2 Lynis — 主机安全审计

```bash
sudo lynis audit system --quick
```

| # | 测试 ID | 类别 | 发现 | 严重度 | PCI/HIPAA 关联 | 修复建议 |
|---|---|---|---|---|---|---|
| LY-01 | `{test_id}` | `{category}` | `{finding}` | `{severity}` | `{compliance}` | `{fix}` |

### 5.3 SSL/TLS 审计

```bash
testssl {TARGET_URL}:{PORT}
```

| # | 检查项 | 状态 | 发现 | 严重度 | 修复建议 |
|---|---|---|---|---|---|
| SS-01 | 协议版本 (TLS 1.0/1.1) | ✅/❌ | `{finding}` | `{severity}` | `{fix}` |
| SS-02 | 弱密码套件 | ✅/❌ | `{finding}` | `{severity}` | `{fix}` |
| SS-03 | 证书有效性 | ✅/❌ | `{finding}` | `{severity}` | `{fix}` |
| SS-04 | HSTS 头 | ✅/❌ | `{finding}` | `{severity}` | `{fix}` |
| SS-05 | 证书公钥长度 | ✅/❌ | `{finding}` | `{severity}` | `{fix}` |

### 5.4 安全头审计

| # | 头 | 状态 | 当前值 | 建议值 | 严重度 |
|---|---|---|---|---|---|
| HD-01 | Content-Security-Policy | ✅/❌ | `{value}` | `default-src 'self'` | `{severity}` |
| HD-02 | X-Frame-Options | ✅/❌ | `{value}` | `DENY` | `{severity}` |
| HD-03 | X-Content-Type-Options | ✅/❌ | `{value}` | `nosniff` | `{severity}` |
| HD-04 | Referrer-Policy | ✅/❌ | `{value}` | `strict-origin-when-cross-origin` | `{severity}` |
| HD-05 | Permissions-Policy | ✅/❌ | `{value}` | `geolocation=(), microphone=()` | `{severity}` |
| HD-06 | Strict-Transport-Security (HSTS) | ✅/❌ | `{value}` | `max-age=31536000; includeSubDomains; preload` | `{severity}` |

### 5.5 Cookie 安全审计

| # | Cookie 名 | HttpOnly | Secure | SameSite | 域 | 路径 | 风险 | 建议 |
|---|---|---|---|---|---|---|---|---|
| CK-01 | `{name}` | ✅/❌ | ✅/❌ | `{value}` | `{domain}` | `{path}` | `{risk}` | `{fix}` |

### 5.6 CORS 配置审计

| # | URL | Access-Control-Allow-Origin | Access-Control-Allow-Credentials | 风险 | 严重度 | 建议 |
|---|---|---|---|---|---|---|
| CO-01 | `{url}` | `{value}` | `{value}` | `{risk}` | `{severity}` | `{fix}` |

### 5.7 信息泄露检查

| # | 检查项 | 发现 | 严重度 | 修复建议 |
|---|---|---|---|---|
| IL-01 | 错误页面暴露框架版本 | `{finding}` | `{severity}` | `{fix}` |
| IL-02 | 调试端点暴露 (/debug, /actuator) | `{finding}` | `{severity}` | `{fix}` |
| IL-03 | API 响应敏感字段 | `{finding}` | `{severity}` | `{fix}` |
| IL-04 | Git 目录暴露 (.git/HEAD) | `{finding}` | `{severity}` | `{fix}` |
| IL-05 | robots.txt 敏感路径 | `{finding}` | `{severity}` | `{fix}` |

---

## 6. 统计汇总

### 6.1 按扫描层

| 层 | 工具 | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 总计 |
|---|---|---|---|---|---|---|
| CSC-1 SAST | Semgrep | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-1 SAST | Bandit | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-1 SAST | Gosec | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-1 SAST | ESLint Security | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-1 密钥 | Gitleaks | `{n}` | `{n}` | — | — | **{sum}** |
| CSC-2 DAST | Nuclei | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-2 DAST | ZAP | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-2 DAST | Nikto | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-2 DAST | ffuf | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-2 SCA | Audit (npm/pip/cargo) | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-2 SCA | Trivy | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-3 Infra | Nmap | `{n}` | `{n}` | `{n}` | — | **{sum}** |
| CSC-3 Infra | Lynis | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| CSC-3 合规 | SSL/头/Cookie/CORS | `{n}` | `{n}` | `{n}` | `{n}` | **{sum}** |
| **总计** | | **{sum}** | **{sum}** | **{sum}** | **{sum}** | **{total}** |

### 6.2 按 OWASP Top 10 映射

| OWASP | 类别 | Critical | High | Medium | Low | 覆盖 |
|---|---|---|---|---|---|---|
| A1 | Broken Access Control | `{n}` | `{n}` | `{n}` | `{n}` | 85% |
| A2 | Cryptographic Failures | `{n}` | `{n}` | `{n}` | `{n}` | 90% |
| A3 | Injection | `{n}` | `{n}` | `{n}` | `{n}` | 95% |
| A4 | Insecure Design | `{n}` | `{n}` | `{n}` | `{n}` | 70% |
| A5 | Security Misconfiguration | `{n}` | `{n}` | `{n}` | `{n}` | 85% |
| A6 | Vulnerable Components | `{n}` | `{n}` | `{n}` | `{n}` | 95% |
| A7 | Auth Failures | `{n}` | `{n}` | `{n}` | `{n}` | 75% |
| A8 | Software Integrity | `{n}` | `{n}` | `{n}` | `{n}` | 70% |
| A9 | Logging/Monitoring | `{n}` | `{n}` | `{n}` | `{n}` | 50% |
| A10 | SSRF | `{n}` | `{n}` | `{n}` | `{n}` | 85% |

---

## 7. 总体扫描结论

| 指标 | 值 |
|---|---|
| 总发现数 | `{total}` |
| 🔴 可部署阻塞 (Critical + 密钥泄露) | `{n}` |
| 🟠 可部署警告 (High) | `{n}` |
| 🟡/🟢 技术债 (Medium + Low) | `{n}` |
| OWASP 综合覆盖 | `{pct}%` |
| **是否可以部署** | ✅/⚠️/❌ |

---

## 8. 合规映射 (如适用)

| 合规标准 | 相关发现数 | 合规状态 |
|---|---|---|
| PCI DSS | `{n}` | ✅/⚠️/❌ |
| SOC 2 | `{n}` | ✅/⚠️/❌ |
| HIPAA | `{n}` | ✅/⚠️/❌ |
| GDPR | `{n}` | ✅/⚠️/❌ |

> 报告由 security-check-centralized Agent (DeepSeek V4 Pro) 自动生成，架构师请核查后与 SECURITY_REVIEW_REPORT 交叉验证。
