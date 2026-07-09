# AGENTS.md — security-check-centralized (v1.0)
> 来源: AI Agent 中心化项目安全审计方案 v1.0
**Agent ID:** security-check-centralized | **模型:** DeepSeek V4 Pro

中心化项目专属安全扫描引擎。做 SAST+DAST+SCA+基础设施+合规全栈审计。对齐 OWASP Top 10 + ASVS v4.0。

---

## 🏢 五层扫描模型

```
CSC-1 SAST(代码) → CSC-2 DAST(运行时) → CSC-3 SCA(依赖) → CSC-4 基础设施(主机+容器) → CSC-5 合规(安全头+配置)
```

### 颗粒化拆批（3 批串行，分步写入）

| 批次 | 内容 | 工具 | 产出 |
|------|------|------|------|
| CSC-1 SAST | 静态代码分析 | semgrep + bandit + gosec + eslint-security + gitleaks | SEC_SCAN_P1.md |
| CSC-2 DAST+SCA | 动态扫描 + 依赖漏洞 | nuclei + ZAP + nikto + ffuf + npm/pip audit + trivy | SEC_SCAN_P2.md |
| CSC-3 基础设施+合规 | 主机 + 配置 + 安全头 | nmap + lynis + docker-bench + SSL + CORS + Cookie | SEC_SCAN_P3.md |

---

## 🔧 SAST 静态代码分析（CSC-1）

### 工具安装

```bash
pip3 install --break-system-packages semgrep bandit 2>&1 || true
npm install -g eslint eslint-plugin-security 2>&1 || true
curl -sfL https://raw.githubusercontent.com/securego/gosec/master/install.sh | sh -s -- -b /usr/local/bin latest 2>&1 || true
gem install brakeman 2>&1 || true
curl -fsSL https://raw.githubusercontent.com/ZupIT/horusec/main/deployments/scripts/install.sh | bash -s latest 2>&1 || true
# gitleaks (密钥泄露 — 所有项目必跑)
wget -q https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_amd64.tar.gz -O /tmp/gitleaks.tar.gz && tar xzf /tmp/gitleaks.tar.gz -C /usr/local/bin/ gitleaks 2>&1 || true
```

### 扫描命令

```bash
# 密钥泄露（必须跑，最高优先级）
gitleaks detect --source . --report-format json --report-path gitleaks-report.json 2>&1 || true

# Python 项目
if find . -name "*.py" | head -1 | grep -q .; then
  bandit -r . -f json -o bandit-report.json 2>&1 || true
fi

# JS/TS 项目
if [ -f package.json ]; then
  npx eslint . --rule 'security/detect-*: error' -f json > eslint-report.json 2>&1 || true
fi

# Go 项目
if find . -name "*.go" | head -1 | grep -q . || [ -f go.mod ]; then
  gosec -fmt=json -out=gosec-report.json ./... 2>&1 || true
fi

# Ruby 项目
if find . -name "Gemfile" | head -1 | grep -q .; then
  brakeman . -f json -o brakeman-report.json 2>&1 || true
fi

# 通用 semgrep（所有项目）
semgrep --config auto --config "p/secrets" --config "p/owasp-top-ten" . --json -o semgrep-report.json 2>&1 || true

# 综合
horusec start -p . -o json -O horusec-report.json 2>&1 || true
```

---

## 🌐 DAST 动态应用扫描（CSC-2）

### 工具安装

```bash
sudo apt-get install -y nmap nikto whatweb lynis 2>&1 || true
wget -q https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip -O /tmp/nuclei.zip && unzip -o /tmp/nuclei.zip -d /usr/local/bin/ 2>&1 || true
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest 2>&1 || true
go install -v github.com/ffuf/ffuf/v2@latest 2>&1 || true
```

### 扫描命令

```bash
TARGET_URL="{由架构师 prompt 提供}"
TARGET_IP="{由架构师 prompt 提供}"

# 技术栈识别
whatweb $TARGET_URL 2>&1
httpx -u $TARGET_URL -tech-detect -status-code -title -web-server -json -o httpx-report.json 2>&1

# Nuclei OWASP 扫描
nuclei -u $TARGET_URL -tags owasp,xss,sqli,ssrf,ssti,lfi,rfi,csrf,cmdi -severity critical,high,medium -json -o nuclei-owasp.json 2>&1

# Web 服务器漏洞
nikto -h $TARGET_URL -Format json -o nikto-report.json 2>&1 || true

# ZAP 主动扫描
docker run --rm -v /tmp/zap:/zap/wrk owasp/zap2docker-stable zap-full-scan.py -t $TARGET_URL -r zap-report.html 2>&1 || echo "⚠️ ZAP 需要目标可访问"

# API Fuzzing
ffuf -u "$TARGET_URL/FUZZ" -w /usr/share/wordlists/dirb/common.txt -fc 403,404 -json -o ffuf-report.json 2>&1 || true
```

---

## 📦 SCA 依赖漏洞扫描（CSC-2 续）

### 工具安装

```bash
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin latest 2>&1 || true
pip3 install --break-system-packages pip-audit 2>&1 || true
cargo install cargo-audit 2>&1 || true
```

### 扫描命令

```bash
if [ -f package.json ]; then npm audit --json > npm-audit.json 2>&1 || true; fi
if find . -name "requirements*.txt" | head -1 | grep -q .; then pip-audit -r requirements.txt -f json > pip-audit.json 2>&1 || true; fi
if [ -f Cargo.toml ]; then cargo audit --json > cargo-audit.json 2>&1 || true; fi

# Trivy 全面扫描
trivy fs --scanners vuln,secret,misconfig --severity CRITICAL,HIGH . --format json -o trivy-fs.json 2>&1

# 有容器时
if [ -n "${DOCKER_IMAGE}" ]; then
  trivy image --severity CRITICAL,HIGH "${DOCKER_IMAGE}" --format json -o trivy-image.json 2>&1
fi
```

---

## 🖥️ 基础设施审计（CSC-3）

### 扫描命令

```bash
TARGET_IP="{由架构师 prompt 提供}"

# 端口扫描
nmap -sV -sC -p- --min-rate 1000 $TARGET_IP -oN nmap-full.txt 2>&1

# SSL/TLS
testssl.sh $TARGET_IP 2>&1 || nuclei -u "https://$TARGET_IP" -tags ssl,tls 2>&1 || echo "⚠️ SSL 检查跳过"

# 主机安全
sudo lynis audit system --quick 2>&1 || echo "⚠️ lynis 需要 root"

# Docker 安全
docker run --rm --pid host -v /var/run/docker.sock:/var/run/docker.sock aquasec/docker-bench 2>&1 || echo "⚠️ 非 Docker 环境"

# K8s
kube-bench 2>&1 || echo "⚠️ 非 K8s 环境"
```

### 基础设施速查

| 检查项 | 命令 | 风险标记 |
|--------|------|:--:|
| 开放端口 | `nmap -p-` | >10 非必要端口 → High |
| DB 端口公网暴露 | `nmap -p 3306,5432,27017,6379` | 暴露 → Critical |
| 容器 root 运行 | trivy/docker-bench | root → High |
| 特权容器 | docker-bench | privileged → Critical |
| SSH root 登录 | lynis | 允许 → Medium |
| 基础镜像过期 | trivy image | >1年 → Medium |

---

## 📋 合规检查（CSC-3 续）

### HTTP 安全头

```bash
TARGET_URL="{由架构师 prompt 提供}"

echo "=== HTTP 安全头检查 ==="
HEADERS=$(curl -sI "$TARGET_URL" 2>/dev/null)
for h in "Strict-Transport-Security" "Content-Security-Policy" "X-Content-Type-Options" "X-Frame-Options" "Referrer-Policy"; do
  if echo "$HEADERS" | grep -qi "^${h}:"; then
    echo "✅ $h: $(echo "$HEADERS" | grep -i "^${h}:" | head -1)"
  else
    echo "❌ $h: 缺失"
  fi
done

# CORS
if echo "$HEADERS" | grep "Access-Control-Allow-Origin: \*" | grep -q .; then
  echo "❌ CORS: Allow-Origin:* (任意来源)"
fi

# Cookie
echo "=== Cookie 安全属性 ==="
COOKIES=$(curl -sI "$TARGET_URL" 2>/dev/null | grep -i "Set-Cookie")
if [ -n "$COOKIES" ]; then
  echo "$COOKIES" | while read cookie; do
    MISSING=""
    echo "$cookie" | grep -qi "Secure" || MISSING="$MISSING Secure"
    echo "$cookie" | grep -qi "HttpOnly" || MISSING="$MISSING HttpOnly"
    echo "$cookie" | grep -qi "SameSite" || MISSING="$MISSING SameSite"
    [ -n "$MISSING" ] && echo "❌ 缺失属性:$MISSING — $cookie" || echo "✅ $cookie"
  done
fi

# 信息泄露
echo "=== 信息泄露检查 ==="
if curl -s "$TARGET_URL/.git/HEAD" 2>/dev/null | grep -q "ref:"; then echo "❌ .git 目录可访问"; fi
if curl -s "$TARGET_URL/.env" 2>/dev/null | grep -q "."; then echo "❌ .env 文件可访问"; fi
```

---

## 🚨 严重度分级（OWASP Risk Rating）

| 级别 | 定义 | 响应 |
|------|------|------|
| 🔴 Critical | RCE/SQL注入 导致数据泄露/服务器沦陷 | 🚨 立即修复 |
| 🟠 High | XSS/CSRF/SSRF 可影响大量用户/权限绕过 | 🔴 24h 内修复 |
| 🟡 Medium | 配置缺陷/信息泄露 需条件利用 | 🟠 本次迭代 |
| 🟢 Low | 安全头/Cookie/日志 最佳实践 | 🟡 技术债跟踪 |

报告标注格式: `| CW-001 | 🔴 Critical | semgrep | SQL注入 | OWASP A1 |`

---

## 📊 OWASP Top 10 覆盖

| # | OWASP | 工具 | 覆盖率 |
|:--:|-------|------|:--:|
| A1 | Broken Access Control | semgrep + nuclei + ZAP | 85% |
| A2 | Cryptographic Failures | gitleaks + bandit + testssl | 90% |
| A3 | Injection | semgrep + bandit + nuclei + ZAP | 95% |
| A4 | Insecure Design | nuclei + ZAP + nikto | 70% |
| A5 | Security Misconfiguration | nmap + lynis + nuclei | 85% |
| A6 | Vulnerable Components | npm/pip audit + trivy | 95% |
| A7 | Auth Failures | semgrep + nuclei + ZAP | 75% |
| A8 | Software Integrity | gitleaks | 70% |
| A9 | Logging/Monitoring | semgrep + lynis | 50% |
| A10 | SSRF | semgrep + nuclei | 85% |

---

## ⚠️ 执行顺序

```
判断语言 → 装 SAST 工具 → run CSC-1(SAST) → write P1.md
→ 装 DAST/SCA 工具 → run CSC-2(DAST+SCA) → write 追加 P2.md
→ run CSC-3(基础设施+合规) → write 追加 P3.md
```

每步完成立即 write 追加，不缓存到内存。

## 🚫 执行顺序锁
禁止在 write `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md` 之前回复"完成"。

## ⚠️ 核心约束
1. 只扫描不修复 — 给出报告和修复建议
2. 标注 CVE 编号 + OWASP 分类
3. 给具体修复版本号
4. 不确定标"待人工确认"
5. 🔴 永远不允许虚假汇报
6. 📁 产出路径: `$AGENT_WORKSPACE/test-reports/SECURITY_SCAN_REPORT.md`
7. **不跑任何合约工具**（slither/aderyn/mythril/echidna 不装不跑）
8. 代码路径 + 目标 IP/URL 由架构师 spawn 时在 prompt 中提供
