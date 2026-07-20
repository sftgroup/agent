# AUDIT_SUMMARY — 架构师三份报告汇总

> **模板版本**: v1.0 | **使用角色**: team4 (架构师) | **模型**: DeepSeek V4 Pro
> **用途**: 汇总 QA + Security + Scan 三份报告 → 统一严重度判定 → 修复优先级

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 项目类型 | `合约 / 中心化 / 混合` |
| 审计日期 | `{YYYY-MM-DD}` |
| 审计批次 | `{BATCH_ID}` |
| Commit Hash | `{COMMIT_HASH}` |

---

## 1. 三份报告源

| 报告 | Agent | 路径 | 状态 |
|---|---|---|---|
| 功能审查 (QA) | qa | `test-reports/QA_REVIEW_REPORT.md` | ✅/❌ |
| 深度安全审查 (SEC) | security | `test-reports/SECURITY_REVIEW_REPORT.md` | ✅/❌ |
| 自动扫描 (SCAN) | security-check / centralized | `test-reports/SECURITY_SCAN_REPORT.md` | ✅/❌ |

---

## 2. 严重度全量汇总

### 2.1 横向合并（去重 + 交叉验证）

| # | 发现描述 | 来源 (QA/SEC/SCAN) | SCSVS/OWASP | 文件:行号 | 严重度 | 一致性 | 最终判定 |
|---|---|---|---|---|---|---|---|
| F-01 | `{description}` | `{sources}` | `{ref}` | `{file}:{line}` | `{severity}` | ✅一致 / ⚠️SEC抬高 / ⚠️SCAN降低 | `{final_severity}` |

### 2.2 按严重度分布

| 严重度 | QA | SEC | SCAN | 去重后 | 意义 |
|---|---|---|---|---|---|
| 🔴 Critical | `{n}` | `{n}` | `{n}` | `{n}` | 资金损失 / 服务器沦陷 → 🚨立即修复 |
| 🟠 High | `{n}` | `{n}` | `{n}` | `{n}` | 单点突破后大量损失 → 24h 修复 |
| 🟡 Medium | `{n}` | `{n}` | `{n}` | `{n}` | 特定条件组合攻击 → 本次迭代修复 |
| 🟢 Low | `{n}` | `{n}` | `{n}` | `{n}` | 最佳实践改进 → 技术债 |
| **总计** | **{sum}** | **{sum}** | **{sum}** | **{sum}** | — |

---

## 3. 交叉验证矩阵

三个 Agent 独立审计 → 找出不一致的判断：

| 发现 | QA 判定 | SEC 判定 | SCAN 判定 | 差异 | 仲裁 |
|---|---|---|---|---|---|
| `{finding}` | `{severity}` | `{severity}` | `{severity}` | `{diff}` | `{ruling}` |

**仲裁规则**:
- 2:1 双边一致 → 采用一致方
- 三方意见各不同 → 架构师取最严重判定
- 自动化报告级别低于 SEC(手动/L3) → 自动抬高到 SEC 级别

---

## 4. 修复优先级矩阵

### P0 — 🚨 必须立即修复 (Critical)

| # | 发现 | 影响 | 修复方案 | 负责人 | 截止 |
|---|---|---|---|---|---|
| P0-01 | `{finding}` | `{impact}` | `{fix}` | `{owner}` | 立即 |

### P1 — 🔴 24 小时内修复 (High)

| # | 发现 | 影响 | 修复方案 | 负责人 | 截止 |
|---|---|---|---|---|---|
| P1-01 | `{finding}` | `{impact}` | `{fix}` | `{owner}` | 24h |

### P2 — 🟠 本次迭代修复 (Medium)

| # | 发现 | 影响 | 修复方案 | 负责人 | Sprint |
|---|---|---|---|---|---|
| P2-01 | `{finding}` | `{impact}` | `{fix}` | `{owner}` | Current |

### P3 — 🟡 技术债 (Low)

| # | 发现 | 改进方向 | 负责人 | 计划 |
|---|---|---|---|---|
| P3-01 | `{finding}` | `{improvement}` | `{owner}` | Backlog |

---

## 5. 修复验证计划

| 阶段 | 内容 | 验证方式 |
|---|---|---|
| 1. 修复 P0 + P1 | 按优先级修复 Critical + High | 架构师直接修改 |
| 2. 回归测试 | spawn tester 跑 E2E/forge/curl | tester Agent |
| 3. 浏览器 E2E | React 页面功能验证 | browser 工具 |
| 4. 链上交易验证 | cast call/send 验证状态 | cast CLI |
| 5. 审计关闭 | 所有 P0/P1 修复后重新 spawn qa+security | 架构师汇总 |

---

## 6. 部署决策

| 条件 | 状态 | 说明 |
|---|---|---|
| P0 Critical = 0 | ✅/❌ | `{n} remaining` |
| P1 High = 0 | ✅/❌ | `{n} remaining` |
| 测试覆盖率 ≥85% | ✅/❌ | `{pct}%` |
| SCSVS 覆盖 ≥80% | ✅/❌ | `{pct}%` |
| OWASP 覆盖 ≥80% | ✅/❌ | `{pct}%` |

### 最终决策

| 决策 | 附条件 |
|---|---|
| ✅ 可以部署 | — |
| ⚠️ 条件部署 | 需 `{conditions}` 完成后 |
| ❌ 不可部署 | 阻塞项: `{blockers}` |

---

## 7. 部署后记录 (部署完成后填写)

| 字段 | 值 |
|---|---|
| 部署时间 | `{timestamp}` |
| 部署位置 | `{server_url}` |
| 合约地址 (如有) | `{contract_address}` |
| 交易哈希 (如有) | `{tx_hash}` |
| 部署人 | team4 (Wayne) |

> 本汇总由架构师根据 qa/security/security-check 三份报告交叉验证后生成。
