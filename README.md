# 🤖 Wayne's AI Agent Team

**架构师**: Wayne (Team4) | **团队规模**: 10 人 | **平台**: OpenClaw AI Agent Platform

## 团队概览

| # | Agent ID | 角色 | 模型 | 职责 |
|---|----------|------|------|------|
| 0 | team4 | 🐺 架构师 | DeepSeek V4 Pro | 调度 · 架构设计 · Bug修复 · SSH部署 |
| 1 | qa | QA 审查员 | DeepSeek V4 Pro | 功能完整性→代码逻辑→测试覆盖 |
| 2 | security | 🔒 安全审计 | GLM-5.2 | 85项 SCSVS 攻击矩阵 + Immunefi |
| 3 | security-check | 🔒 合约扫描 | DeepSeek V4 Pro | 合约专属: Slither/Aderyn/Mythril/Echidna |
| 4 | security-check-centralized | 🏢 中心化扫描 | DeepSeek V4 Pro | 中心化专属: SAST/DAST/SCA/基础设施 |
| 5 | tester | 🧪 测试工程师 | DeepSeek V4 Pro | Forge/Curl/Browser/性能 |
| 6 | ux-researcher | UX 研究 | DeepSeek V4 Pro | 用户研究、交互分析 |
| 7 | design-advisor | 设计顾问 | DeepSeek V4 Pro | 竞品 UI、设计趋势 |
| 8 | ui-design-critique | 🎨 设计评审 | DeepSeek V4 Pro | 四维量化评审 |
| 9 | data-scientist | 数据科学 | DeepSeek V4 Pro | 数据报告、AB测试 |

## 文件索引

| 文件 | Agent | 行数 | 版本 |
|------|-------|------|------|
| [00-architect-team4.md](./agents/00-architect-team4.md) | team4 (架构师) | ~800 | v10.4.0 |
| [01-qa.md](./agents/01-qa.md) | qa | ~55 | v6.7 |
| [02-security.md](./agents/02-security.md) | security | ~300 | v8.0 |
| [03-security-check-contracts.md](./agents/03-security-check-contracts.md) | security-check (合约) | ~170 | v8.2 |
| [04-security-check-centralized.md](./agents/04-security-check-centralized.md) | security-check-centralized | ~180 | v1.0 |
| [05-tester.md](./agents/05-tester.md) | tester | ~240 | v7.0 |
| [06-ux-researcher.md](./agents/06-ux-researcher.md) | ux-researcher | ~20 | v3.4 |
| [07-design-advisor.md](./agents/07-design-advisor.md) | design-advisor | ~20 | v3.4 |
| [08-ui-design-critique.md](./agents/08-ui-design-critique.md) | ui-design-critique | ~170 | v1.1.0 |
| [09-data-scientist.md](./agents/09-data-scientist.md) | data-scientist | ~15 | v3.4 |

## 架构亮点

### 双安全扫描 Agent 拆分
- `security-check` (合约专属) — 8 工具，专攻 Solidity/Foundry
- `security-check-centralized` (中心化专属) — 15 工具，专攻 Web/API/基础设施
- 避免单 Agent AGENTS.md 过长（453→170/180行），防止上下文截断

### 审计流水线
- **合约**: SCSVS v1.2 × Immunefi × 85 项攻击矩阵
- **中心化**: OWASP Top 10 × ASVS v4.0 × 5层扫描

## 相关文档
- [完整方案 v1.0](https://www.feishu.cn/docx/Lg4hdf4p2oPEo5xc2qycqT8mnzl)
- [中心化审计方案](https://www.feishu.cn/docx/BObudNoq5o9P4Xxssl4cREPJnnf)
- [安全审计体系方案](https://www.feishu.cn/docx/PHkVdGMGXoRsS8xPgL1cwq3BnOe)

## 更新日期
2026-07-06
