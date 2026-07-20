# E2E_TEST_REPORT — 端到端测试报告

> **模板版本**: v1.0 | **使用角色**: team4 (架构师/autotest) | **模型**: DeepSeek V4 Pro
> **执行**: 架构师修改代码后自动执行

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 项目类型 | `合约 / 中心化 / 混合` |
| 测试日期 | `{YYYY-MM-DD}` |
| Commit Hash | `{COMMIT_HASH}` |
| 测试环境 | `localhost / staging / sepolia / mainnet` |

---

## 1. Contract Tests (Forge)

### 1.1 测试执行

```bash
forge test --match-path "test/**/*.t.sol" -vvv
```

### 1.2 结果

| 指标 | 值 |
|---|---|
| 总测试数 | `{total}` |
| 通过 | `{pass}` |
| 失败 | `{fail}` |
| 跳过 | `{skip}` |
| 执行时间 | `{duration}` |

### 1.3 失败详情

| # | 测试函数 | 合约 | 错误信息 | 严重度 | 根因 |
|---|---|---|---|---|---|
| FTG-01 | `{test_fn}` | `{contract}` | `{error}` | `{severity}` | `{root_cause}` |

### 1.4 覆盖率

| 指标 | 值 | 目标 |
|---|---|---|
| 行覆盖率 | `{line_pct}%` | ≥85% |
| 分支覆盖率 | `{branch_pct}%` | ≥75% |
| 函数覆盖率 | `{fn_pct}%` | ≥90% |

---

## 2. API Tests (Curl/Httpie)

### 2.1 端点清单

| # | Method | Endpoint | Status | 期望码 | 实际码 | 响应时间 | 结果 |
|---|---|---|---|---|---|---|---|
| API-01 | GET | `/api/...` | ✅/❌ | 200 | `{code}` | `{ms}ms` | ✅/🔴 |

### 2.2 认证测试

| # | 场景 | 结果 | 状态码 | 说明 |
|---|---|---|---|---|
| AUTH-01 | 有效 Bearer Token | ✅/❌ | `{code}` | `{note}` |
| AUTH-02 | 过期 Token | ✅/❌ | `{code}` (expected 401) | `{note}` |
| AUTH-03 | 无 Token | ✅/❌ | `{code}` (expected 401) | `{note}` |

### 2.3 部署验证 (curl 快速冒烟)

```bash
curl -sS {BASE_URL}/health  # 期望 200/healthy
curl -sS {BASE_URL}/api/...  # 期望 200+
```

| # | URI | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| DEP-01 | `{BASE_URL}/health` | 200 | `{code}` | ✅/❌ |
| DEP-02 | `{BASE_URL}/api/...` | 200 | `{code}` | ✅/❌ |

---

## 3. Frontend Tests (Browser E2E)

### 3.1 页面渲染

| # | 页面 | 路径 | 渲染 | 无 JS Error | 截图 |
|---|---|---|---|---|---|
| FE-01 | `{page}` | `{route}` | ✅/❌ | ✅/❌ | `{screenshot_path}` |

### 3.2 关键交互

| # | 流程 | 步骤数 | 结果 | 截图 |
|---|---|---|---|---|
| FE-U01 | `{flow}` | `{n}` | ✅/❌ | `{path}` |

### 3.3 前端安全

| # | 检查项 | 输入 | 结果 | 说明 |
|---|---|---|---|---|
| FE-S01 | XSS 输入 | `<script>alert(1)</script>` | ✅/❌ | `{note}` |
| FE-S02 | HTML 注入 | `<h1>HACKED</h1>` | ✅/❌ | `{note}` |

---

## 4. On-Chain Tests (Cast)

### 4.1 合约状态验证

```bash
cast call {CONTRACT_ADDRESS} "{function}" {args} --rpc-url {RPC_URL}
```

| # | 函数 | 参数 | 期望值 | 实际值 | 结果 |
|---|---|---|---|---|---|
| OC-01 | `{fn}()` | `{args}` | `{expected}` | `{actual}` | ✅/❌ |

### 4.2 交易验证 (部署后)

| # | 函数 | 参数 | 交易哈希 | 状态 | 结果 |
|---|---|---|---|---|---|
| TX-01 | `{fn}()` | `{args}` | `{tx_hash}` | ✅/❌ | ✅/❌ |

---

## 5. 回归测试 (修改代码后)

### 5.1 受影响范围

| # | 修改文件 | 影响合约 | 影响 API | 影响前端 | 回归项 |
|---|---|---|---|---|---|
| RG-01 | `{file}` | `{contracts}` | `{endpoints}` | `{pages}` | `{items}` |

### 5.2 回归结果

| # | 测试项 | 类型 | 结果 | 说明 |
|---|---|---|---|---|
| RG-01 | `{test_case}` | CT/AT/FT | ✅/❌ | `{note}` |

---

## 6. 汇总

| 层 | 总数 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| Forge (合约) | `{n}` | `{n}` | `{n}` | `{pct}%` |
| API | `{n}` | `{n}` | `{n}` | `{pct}%` |
| Frontend | `{n}` | `{n}` | `{n}` | `{pct}%` |
| On-Chain | `{n}` | `{n}` | `{n}` | `{pct}%` |
| **总计** | **{sum}** | **{sum}** | **{sum}** | **{pct}%** |

### 最终判定

| 条件 | 状态 |
|---|---|
| Forge 通过率 ≥95% | ✅/❌ |
| API 通过率 ≥95% | ✅/❌ |
| Frontend 通过率 ≥90% | ✅/❌ |
| 未新增回归缺陷 | ✅/❌ |
| **是否可以发布** | ✅/⚠️/❌ |

> 由架构师/autotest 执行后自动生成，对应 test-reports/ 下的 CT/AT/FT 场景文件。
