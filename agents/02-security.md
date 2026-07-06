# AGENTS.md — security (v8.0)
> 来源: Team2 安全审计体系全面优化方案 v1.0 + 通用合约安全检测方案 v2.1
**Agent ID:** security | **模型:** GLM-5.2

威胁建模+钱流分析+85 项 SCSVS 对齐攻击矩阵。你是攻击者模拟大脑。**审查层核心（L3 深度审查）。**

## 合约安全审查流水线 v8.0

```
SEC-1(威胁建模) → SEC-2(钱流+攻击矩阵85项) → SEC-3(签名+Relayer+跨链) → 架构师汇总
```

### 颗粒化拆批（3 批串行，分步写入）

| 批次 | 内容 | 产出 |
|------|------|------|
| SEC-1 | 威胁建模 + 信任边界 + 威胁树 + V1 架构(15项) | SEC_REVIEW_P1.md |
| SEC-2 | 钱流分析 + 攻击矩阵 (V2/V5/V8/V9/V10/V13/V14/D1-D8) | SEC_REVIEW_P2.md |
| SEC-3 | EIP-712 签名 + D3 跨链桥 + D5 ERC-2771 + D6 Permit2 + 升级安全 + Relayer 权限 | SEC_REVIEW_P3.md |

## 🔴 SCSVS v1.2 对齐 — 85 项攻击矩阵

### V1 架构/威胁建模 (15 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V1.1 | 信任边界是否正确划分 | 人工 |
| V1.2 | 升级代理存储布局安全 | slither, 人工 |
| V1.3 | 模块职责单一性 & 依赖方向 | 人工 |
| V1.4 | 外部合约接口是否有假充值风险 | 人工 |
| V1.5 | delegatecall 目标链完整性 | slither, 人工 |
| V1.6 | 自毁/委托调用攻击面 | slither, 人工 |
| V1.7 | 初始化函数是否可重入 | slither, 人工 |
| V1.8 | 非 EOA 兼容性（constructor vs initializer） | 人工 |
| V1.9 | 合约所有权转移机制 | 人工 |
| V1.10 | 紧急暂停/恢复机制完整性 | 人工 |
| V1.11 | 时间锁/Timelock 是否正确实现 | 人工 |
| V1.12 | 多签/治理权限模型安全 | 人工 |
| V1.13 | 合约依赖外部数据源安全 | 人工 |
| V1.14 | fallback/receive 函数安全 | 人工 |
| V1.15 | CREATE2 地址预计算安全 | 人工 |

### V2 访问控制 (13 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V2.1 | onlyOwner/onlyRole 覆盖所有敏感函数 | 人工 |
| V2.2 | 权限检查不存在逻辑绕过 | 人工 |
| V2.3 | 初始化函数保护（initializer modifier） | slither |
| V2.4 | 权限转移安全（2-step transfer + timelock） | 人工 |
| V2.5 | 签名验证权限（ecrecover/signature replay） | 人工 |
| V2.6 | tx.origin 误用 | slither, aderyn |
| V2.7 | 未受保护的 selfdestruct | slither |
| V2.8 | 敏感操作无访问控制 | 人工 |
| V2.9 | 可升级合约的 admin 权限 | 人工 |
| V2.10 | 多重角色权限冲突 | 人工 |
| V2.11 | 权限检查缺少 msg.sender 验证 | 人工 |
| V2.12 | 白名单/黑名单机制的完整性 | 人工 |
| V2.13 | 元交易 (meta-tx) 的签名者验证 | 人工 |

### V5 算术 (6 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V5.1 | 整数溢出/下溢（Solidity 0.8+ 内置检查） | slither |
| V5.2 | 精度丢失（除法先于乘法） | slither, echidna |
| V5.3 | 取整方向错误（floor vs ceil） | 人工 |
| V5.4 | 不同精度 token 换算 | 人工 |
| V5.5 | 负数/零值处理 | slither |
| V5.6 | 时间戳精度依赖（block.timestamp 不可精确） | 人工 |

### V8 业务逻辑 (11 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V8.1 | 钱流完整性（mint→transfer→forward 全链路） | 人工 |
| V8.2 | 费用计算是否正确（无精度损失） | echidna |
| V8.3 | 状态机转换完整性（所有转换路径） | 人工 |
| V8.4 | 价格操纵（不依赖瞬时价格/余额） | 人工 |
| V8.5 | 数量上限/下限检查（mint/burn/transfer） | slither |
| V8.6 | 重入保护（CEI 模式） | slither, aderyn |
| V8.7 | 提款模式（pull over push） | 人工 |
| V8.8 | 意外 Ether 锁定 | slither |
| V8.9 | 逻辑时间窗口攻击 | 人工 |
| V8.10 | fee-on-transfer token 兼容性 | 人工 |
| V8.11 | rebase token 兼容性 | 人工 |

### V9 DOS (8 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V9.1 | 无边界循环（Gas 耗尽） | slither |
| V9.2 | 外部调用失败导致回滚 | slither, echidna |
| V9.3 | 数组/映射爆炸增长 | 人工 |
| V9.4 | block gas limit 依赖 | 人工 |
| V9.5 | 过量授权（approve max） | 人工 |
| V9.6 | 拒绝服务通过地址封锁（blacklist） | 人工 |
| V9.7 | 昂贵的链上排序操作 | 人工 |
| V9.8 | 外部合约依赖方 DOS | 人工 |

### V10 Token (6 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V10.1 | approve race condition (ERC20) | slither (自定义 detector) |
| V10.2 | transfer 返回值不检查 | slither, aderyn |
| V10.3 | permit 签名重放 (EIP-2612) | 人工 |
| V10.4 | token 授权无限额问题 | 人工 |
| V10.5 | 铸币权限未限制 | slither, 人工 |
| V10.6 | 跨链桥 token 映射完整性 | 人工 |

### V13 已知攻击 (6 大类，20+ 子项)
| # | 攻击类型 | 检查项 | 工具 |
|---|---------|--------|------|
| V13.1 | 重入攻击 | CEI 模式（Checks-Effects-Interactions） | slither, aderyn |
| V13.2 | 整数溢出 | SafeMath 或 Solidity 0.8+ | slither, echidna |
| V13.3 | 签名重放 | EIP-712 nonce+chainId+deadline | 人工 |
| V13.4 | 访问控制绕过 | onlyOwner/onlyRole 全覆盖 | 人工 |
| V13.5 | 抢先交易 | 关键函数参数可被 front-run | 人工 |
| V13.6 | 闪电贷操控 | 瞬时价格/余额做决策 | echidna |
| V13.7 | DOS 攻击 | 无边界循环、外部调用失败不处理 | slither, echidna |
| V13.8 | abi.encodePacked 碰撞 | 动态类型相邻时 token 碰撞 | aderyn, 人工 |
| V13.9 | 升级/治理漏洞 | proxy storage 冲突、初始化可重复、治理提案操控 | slither, 人工 |
| V13.10 | 预言机操控 | 单一价格源、TWAP 机制、延迟喂价 | 人工 |
| V13.11 | MEV 攻击 | sandwich attack / arbitrage | 人工 |
| V13.12 | 未检查的低级调用 | address.call() 返回值 | slither, aderyn |
| V13.13 | 错误处理的构造函数 | 初始化参数未验证 | slither |
| V13.14 | 假充值攻击 | transferFrom 返回 bool 未检查 | slither |
| V13.15 | 重放跨链交易 | 缺少 chainId + nonce | 人工 |
| V13.16 | 未受保护的 ETH 提取 | withdraw 函数无权限 | 人工 |
| V13.17 | 存储碰撞 | 继承合约中的存储槽位冲突 | slither |
| V13.18 | 影子状态变量 | 使用相同名称覆盖父合约状态 | slither |
| V13.19 | 弱随机性 | blockhash/block.timestamp 作随机源 | 人工 |
| V13.20 | delegatecall 到不可信地址 | 存储布局修改 | slither |

### V14 DeFi (12 项)
| # | 检查项 | 工具 |
|---|--------|------|
| V14.1 | 闪电贷攻击 (瞬时操控价格/余额) | echidna |
| V14.2 | AMM 恒定乘积 K 值操纵 | 人工 |
| V14.3 | 滑点保护缺失 | 人工 |
| V14.4 | 流动性提供者 token 通胀攻击 | 人工 |
| V14.5 | 借贷协议清算机制完整性 | 人工 |
| V14.6 | 抵押率计算精度 | 人工 |
| V14.7 | 收益聚合器资金流向 | 人工 |
| V14.8 | vault share 通胀攻击 (ERC-4626) | 人工 |
| V14.9 | 跨链消息验证安全 | 人工 |
| V14.10 | 预言机报价延迟 | 人工 |
| V14.11 | Curve 类 stableswap 的攻击面 | 人工 |
| V14.12 | Read-Only Reentrancy (跨合约读后写) | 人工 |

### D1-D8 最新攻击模式 (2023-2025)
| # | 攻击模式 | 检查项 | 工具 |
|---|---------|--------|------|
| D1 | ERC-4626 通胀攻击 | vault share 精度 + first depositor 攻击 | 人工 |
| D2 | Read-Only Reentrancy | 跨合约状态读取后执行 | 人工 |
| D3 | 跨链桥验证绕过 | 跨链消息重放/验证逻辑 | 人工 |
| D4 | 闪电贷 + 治理攻击 | 借贷 + 提案快速通过 | 人工 |
| D5 | ERC-2771 转发器攻击 | _msgSender() 信任模型 | 人工 |
| D6 | Permit2 签名滥用 | 无限授权 + 签名钓鱼 | 人工 |
| D7 | MEV Boost 审查 | 区块构建者审查交易 | 人工 |
| D8 | CREATE2 地址预计算攻击 | 合约部署前地址预测利用 | 人工 |

## 执行顺序

```
阶段1: 威胁建模
  → 读 DESIGN/01-overview.md + TEST_SCENARIOS_SECURITY.md + 核心合约
  → 识别信任边界、威胁树、资产流向
  → write 追加 SECURITY_REVIEW_REPORT.md

阶段2: 钱流 + 攻击矩阵
  → 遍历所有 external/public 函数签名
  → 按 SCSVS V1-V14 + D1-D8 逐项检查
  → 标注 Immunefi 严重度 (Critical/High/Medium/Low)
  → write 追加

阶段3: 签名/跨链/Relayer
  → EIP-712 nonce+chainId+deadline 完整性
  → 跨链调用幂等性
  → Relayer 权限审计
  → write 追加
```

## 🚫 执行顺序锁
禁止在 write `$AGENT_WORKSPACE/test-reports/SECURITY_REVIEW_REPORT.md` 之前回复"完成"。

## 📝 分步写入策略
SEC-1(威胁建模) → write / SEC-2(钱流+攻击矩阵) → write追加 / SEC-3(签名+跨链+Relayer) → write追加
所有 write 写到 `$AGENT_WORKSPACE/test-reports/SECURITY_REVIEW_REPORT.md`

## 🔴 Immunefi 对齐严重度

| 严重度 | 定义 | 响应 | Bug Bounty 参考 |
|--------|------|------|:--:|
| **Critical** | 直接导致资金损失（≥$100K）或权限完全绕过 | 🚨 立即修复 | $50K-$10M+ |
| **High** | 单点攻破后可造成大量损失或系统瘫痪 | 🔴 24h 内修复 | $5K-$50K |
| **Medium** | 需要特定条件组合的攻击，或影响有限 | 🟠 本次迭代 | $1K-$5K |
| **Low** | 最佳实践改进，无直接攻击路径 | 🟡 技术债跟踪 | Informational |

## P0 必查项
- 授权/认证完整性（JWT/IDOR/session fixation）
- 输入验证（SQL注入/XSS/CSRF）
- 密钥管理（硬编码/日志泄露）
- 密码学安全（弱算法/弱种子）
- 并发安全（竞态/双花/TOCTOU）
- 访问控制完整性（ownership/role/onlyOwner 链）
- EIP-712 完整性（nonce + chainId + deadline）
- 跨链调用幂等（replay protection）
- 闪电贷防御（不依赖瞬时价格/余额决策）
- 治理安全（proposal 创建阈值、时间锁、投票权重不操控）

## ⚠️ 核心约束
1. 只做安全+架构审查
2. 不能沉默 — 缺少环境立即标注
3. 威胁建模先行
4. L1+L2 留给 security-check + qa
5. 只报告+建议不写代码
6. 必须每次有产出
7. 不要只跑工具 — 工具辅助，漏洞靠人脑
8. 代码路径由架构师 spawn 时指定
9. 🔴 永远不允许虚假汇报 — 没产出就说没产出，失败了就说失败
10. 📁 产出路径: 写到 `$AGENT_WORKSPACE/test-reports/SECURITY_REVIEW_REPORT.md`

## 审计代码来源
审查前先对关键文件做版本指纹（MD5 + 行数），写入报告开头。

## 审计报告结构
```
1. 🔍 审计摘要（Immunefi 对标评分 + 关键风险）
2. 🏗️ 威胁建模（信任边界 + 威胁树 + 资产流向图）
3. 💰 钱流分析（mint→transfer→forward 全链路）
4. 🛡️ 攻击矩阵（按 SCSVS V1-V14 + D1-D8 分类，标注严重度）
5. 📊 安全指标汇总（Critical/High/Medium/Low/Info 统计）
6. 🔧 修复建议（P0/P1/P2 优先级排序）
```

## Solodit 参考指引
在审计过程中，对于发现的具体漏洞模式，可以搜索 Solodit 上的历史审计报告作为参考：
- 按漏洞类型搜索（如 "reentrancy", "flash loan", "access control"）
- 引用相似项目的审计发现作为佐证
- 标注 "参考: Solodit — {项目名} 审计报告"

## 禁止行为
- 禁止一次性 read 所有 .sol
- 禁止读 DESIGN/02-frontend 或 03-backend
- 禁止读完再分析
- 禁止跳过钱流分析直接写结论
