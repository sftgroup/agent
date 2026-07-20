# TEST_SCENARIOS_CT — 合约测试场景

> **用途**: 架构师每次修改合约代码后更新，覆盖合约所有关键路径。
> **执行**: `forge test --match-path test/**/*.t.sol -vvv`

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 合约文件 | `{CONTRACTS_PATH}` |
| 更新日期 | `{YYYY-MM-DD}` |
| 关联 Commit | `{COMMIT_HASH}` |

---

## 1. 核心功能测试 (HAPPY PATH)

| # | 合约 | 函数 | 输入 | 期望输出 | Pre-conditions | Post-assertions |
|---|---|---|---|---|---|---|
| CT-01 | `{contract}` | `{fn}()` | `{input}` | `{expected}` | `{pre}` | `{post}` |

---

## 2. 边界值测试

| # | 合约 | 函数 | 边界 | 输入 | 期望行为 |
|---|---|---|---|---|---|
| CT-B01 | `{contract}` | `{fn}()` | 最小值 | `{min_val}` | `{expected}` |
| CT-B02 | `{contract}` | `{fn}()` | 最大值 | `{max_val}` | `{expected}` |
| CT-B03 | `{contract}` | `{fn}()` | 零值 | `0` | `{expected}` |
| CT-B04 | `{contract}` | `{fn}()` | 溢出值 | `{overflow}` | revert |

---

## 3. 权限控制测试

| # | 合约 | 函数 | 角色 | 场景 | 期望行为 |
|---|---|---|---|---|---|
| CT-A01 | `{contract}` | `{fn}()` | Owner | 仅有Owner可调用 | ✅ |
| CT-A02 | `{contract}` | `{fn}()` | Non-Owner | 非Owner调用 | revert |
| CT-A03 | `{contract}` | `{fn}()` | Role | Role授权调用 | ✅ |
| CT-A04 | `{contract}` | `{fn}()` | 未授权 | 无Role调用 | revert |

---

## 4. 安全攻击场景

| # | 合约 | 函数 | 攻击类型 | SCSVS | 攻击输入 | 期望防护 |
|---|---|---|---|---|---|---|
| CT-S01 | `{contract}` | `{fn}()` | 重入攻击 | V13.1 | `{attack}` | revert / CEI |
| CT-S02 | `{contract}` | `{fn}()` | 整数溢出 | V5.1 | `{attack}` | revert |
| CT-S03 | `{contract}` | `{fn}()` | 签名重放 | V13.2 | `{attack}` | revert |
| CT-S04 | `{contract}` | `{fn}()` | 闪电贷操纵 | V14.1 | `{attack}` | revert |

---

## 5. 状态机转换 (如有)

| # | 合约 | 状态A | 触发条件 | 状态B | 期望 |
|---|---|---|---|---|---|
| CT-SM01 | `{contract}` | `Active` | `pause()` | `Paused` | All tx revert |
| CT-SM02 | `{contract}` | `Paused` | `unpause()` | `Active` | Resume |

---

## 6. 事件验证

| # | 合约 | 函数 | 预期事件 | 预期参数 | 期望 |
|---|---|---|---|---|---|
| CT-E01 | `{contract}` | `{fn}()` | `{event}` | `{params}` | 验证 emit |

---

## 7. Gas 消耗 (如有)

| # | 函数 | 预期 Gas | 上限 Gas | 实际 Gas |
|---|---|---|---|---|
| CT-G01 | `{fn}()` | `{expected}` | `{limit}` | `{actual}` |

> 更新后执行: `forge test --match-path "test/**/*.t.sol" -vvv > test-reports/forge-test-output.txt`
