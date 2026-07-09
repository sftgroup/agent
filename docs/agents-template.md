# AGENTS.md MCP 接入规则 — 直接复制到你的 agent

> ⚠️ 这份规则是为 OpenClaw agent 设计的标准 MCP 接入规则。
> 复制到你的 agent 的 AGENTS.md 末尾，agent 就会自动通过 MCP 调用中心服务，不再裸用 shell 命令。

---

## MCP 服务器

本 agent 接入以下中心 MCP 服务（`43.156.46.187`）：

| MCP 名称 | 端口 | 工具数 | 用途 |
|----------|------|--------|------|
| `git` | 3082 | 18 | Git 仓库管理、提交、同步、审计、SHA 溯源 |
| `code-review` | 9001 | 6 | 代码机械检查（lint/format/type/complexity/deps） |
| `build` | 3081 | 6 | 项目构建（npm/docker/react-native/flutter/expo） |
| `solana-build` | 3080 | 6 | Solana 合约编译、部署、链上读取 |

---

## Git & 代码管理规则

### ✅ 只通过 git-mcp 操作
```
禁止: exec git clone/pull/push/commit
必须: 调用 git-mcp 对应工具
```

### 提交流程（严格按顺序）
```
git_status(team)          → 检查本地变更
repo_check(team)          → 完整性检查
git_push(team, message)   → 增量提交到 MCP 本地仓库
git_sync(team)            → 推送到 GitHub
```

### Commit Message 格式
```
type(scope): 做了什么事

为什么改
改了哪些文件
影响范围 / before-after
```
type 取值: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore`

❌ 禁止的 message: "fix bug", "update", "wip", "tmp"

### 同步到测试服务器
```
repo_sync(team, host, path) → rsync 代码到测试机，返回 sync_sha
repo_snapshot(team)         → 读取当前 SHA（不触发同步）
```

---

## 代码检查规则

### 每次代码改动后
```
review_all(project_path, language) → 全量检查（lint + format + type + complexity + deps）
```
或按需单项检查：
```
review_lint(project_path, language)
review_format(project_path, language)
review_types(project_path, language)
review_complexity(project_path)
review_deps(project_path)
```

### 检查报告规范
- 每次 review 结果必须回复给用户
- 报告必须引用 `snapshot_sha`（通过 `repo_sync` / `repo_snapshot` 获取）
- P0 问题必须修复后才能 push；P1 问题标注建议修复
- 不要同时修 2 个以上的 P0 问题，先修完再跑下一轮

---

## 构建规则

### ❌ 禁止裸构建
```
禁止: exec pnpm build / npm run build / cargo build-sbf / docker build / flutter build / npx expo build
必须: 通过 build-mcp 对应工具
```

### 构建流程
```
1. 确保代码已 git_push + repo_check 通过
2. 确保代码已 code-review 通过
3. build_npm / build_docker / build_mobile  → 隔离工作区 /tmp/build-mcp/{uuid}/
4. 查看构建结果 → build_status(buildId)
5. 构建完成后 → build_clean(buildId) 释放磁盘
```

### 定期使用
```
build_clean(all=true) → 清理超过 24h 的构建目录
build_disk()          → 查看磁盘占用
```

---

## Solana 合约规则

### ❌ 禁止裸操作
```
禁止: exec cargo build-sbf / solana program deploy / solana program show
必须: 通过 solana-mcp 对应工具
```

### 编译 & 部署
```
solana_build(projectName, edition) → 编译 SBF
solana_deploy(soPath, programId, keypairName) → 部署
```

### 链上操作
```
solana_read_state(programId, seed) → 读取账户数据
solana_verify_tx(signature)        → 验证交易
solana_balance(address)            → 查询余额
solana_history(address, limit)     → 交易历史
```

### Keypair 安全
```
❌ 禁止代码中硬编码私钥
❌ 禁止在 log、commit message、回复中暴露私钥
❌ 禁止将 id.json 上传到仓库
✅ 使用 solana-mcp 管理的 keypair，通过 keypairName 参数引用
```

---

## 永远不要做的事

| 禁止 | 原因 | 替代 |
|------|------|------|
| `exec git push/pull` | 没有审计、没有检查、没有增量存储 | `git_push` / `git_sync` |
| `exec pnpm build` | 无隔离、无审计、污染本地 | `build_npm` |
| `exec docker build` | 无标准工作区 | `build_docker` |
| `exec cargo build-sbf` | keypair 泄露风险 | `solana_build` |
| `exec solana program deploy` | 私钥暴露给 agent | `solana_deploy` |
| 写模糊的 commit message | 不可追溯 | `type(scope): 详细说明` |
| 跳过 repo_check 直接 push | 破坏代码完整性 | 先 repo_check |
| 构建未提交/未 review 的代码 | 构建产物不可审计 | 先 push + review |
| 在回复中暴露私钥、API token | 安全风险 | 脱敏或省略 |

---

## 你是哪个角色？裁剪不需要的规则

以下规则裁剪适合你的 agent。不是每个 agent 都需要所有 MCP。

**如果你是 Solana 合约开发 agent：**
→ 保留全部规则（Git + Code Review + Build + Solana）

**如果你是前端/后端开发 agent：**
→ 删除「Solana 合约规则」部分，保留其他三项

**如果你是代码审计专用 agent：**
→ 只保留「Git & 代码管理规则」「代码检查规则」

**如果你是构建/部署专用 agent：**
→ 保留「Git & 代码管理规则」「构建规则」

---

## 快速验证

接入后运行这些命令确认 MCP 连通：

```
git_status(team)              → 应返回仓库状态（不是 error）
build_disk()                  → 应返回磁盘信息
review_all("/opt/mcp/repos/your-team", "js-ts") → 应返回检查结果（可能 "no files found"）
```

如果返回 `tool not found` 或连接失败，检查 `openclaw.json` 中 `tools.mcpServers` 配置是否正确。
