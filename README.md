# Agent Skills & MCP Services

SFT Group 的 OpenClaw agent 技能库和远程工具服务。

---

## 目录结构

```
sftgroup/agent/
├── skills/                    # Skill 知识库（agent 加载即用）
│   └── solana-anchor/         # Solana Anchor 合约开发
│       ├── SKILL.md
│       ├── scripts/           # 可执行脚本
│       └── templates/         # 代码模板
│
└── mcp/                       # MCP 远程工具服务（独立部署）
    ├── solana-mcp/            # Solana 合约编译部署
    └── build-mcp/             # 全栈构建服务
```

---

## 一、Skills 注册

### 安装到本地

```bash
# 安装到当前 agent 的 workspace
openclaw skills install git:sftgroup/agent@master#skills/solana-anchor --as solana-anchor

# 安装到全局（所有 agent 可用）
openclaw skills install git:sftgroup/agent@master#skills/solana-anchor --as solana-anchor --global
```

### 验证

```bash
openclaw skills list | grep solana-anchor
```

### 自动加载条件

Skill 内置 gating，只在以下条件满足时自动激活：
- 操作系统：Linux
- 已安装：`solana` + `cargo`
- 可选：`cargo-build-sbf`

如果工具链未安装，skill 会引导 agent 执行 `scripts/solana-install.sh` 自动安装 Agave 2.3.3。

---

## 二、MCP 服务注册

### 2.1 solana-mcp — 合约编译部署

**部署到服务器：**

```bash
# 在目标服务器上
git clone https://github.com/sftgroup/agent.git
cd agent/mcp/solana-mcp

# 安装依赖 + 编译
pnpm install && pnpm build

# 编辑配置
mkdir -p ~/.solana-mcp
cat > ~/.solana-mcp/config.json << 'EOF'
{
  "port": 3080,
  "host": "127.0.0.1",
  "rpcUrl": "https://api.mainnet-beta.solana.com",
  "keypairs": {
    "default": "/home/ubuntu/.config/solana/id.json"
  },
  "projects": {
    "contra-ai": "/home/ubuntu/contra-ai-solana"
  },
  "historyPath": "/home/ubuntu/.solana-mcp/history.jsonl"
}
EOF

# 启动（systemd 或直接运行）
sudo cp solana-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now solana-mcp

# 验证
curl http://127.0.0.1:3080/health
```

**前置要求：** Node.js 22+、pnpm、Solana CLI 2.3.x（`solana` + `cargo build-sbf`）。

**注册到 OpenClaw（在 agent 配置中）：**

```json5
{
  "tools": {
    "mcpServers": {
      "solana-build": {
        "type": "http",
        "url": "http://<服务器IP>:3080",
        "tools": [
          "solana_build",
          "solana_deploy",
          "solana_read_state",
          "solana_verify_tx",
          "solana_balance",
          "solana_history"
        ]
      }
    }
  }
}
```

**API 路由：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/tools` | 列出所有 tool 及参数 schema |
| `POST` | `/tools/solana_build` | 编译合约 |
| `POST` | `/tools/solana_deploy` | 部署/升级合约 |
| `POST` | `/tools/solana_read_state` | 读链上 PDA 状态 |
| `POST` | `/tools/solana_verify_tx` | 确认交易 |
| `POST` | `/tools/solana_balance` | 查询余额 |
| `POST` | `/tools/solana_history` | 操作历史 |
| `GET` | `/health` | 健康检查 |

**Tool 使用示例：**

```bash
# 查看所有 tool
curl http://127.0.0.1:3080/tools

# 编译合约（通过 project name）
curl -X POST http://127.0.0.1:3080/tools/solana_build \
  -H 'Content-Type: application/json' \
  -d '{"projectName":"contra-ai","edition":"2021"}'

# 部署合约
curl -X POST http://127.0.0.1:3080/tools/solana_deploy \
  -H 'Content-Type: application/json' \
  -d '{"soPath":"/home/ubuntu/contra-ai-solana/target/deploy/contra_ai.so","programId":"Gw8rwk9w8HNn8Emcgximggy9gtxxQaA7q6hHqboUT8aE","keypairName":"default"}'

# 查询余额（指定地址）
curl -X POST http://127.0.0.1:3080/tools/solana_balance \
  -H 'Content-Type: application/json' \
  -d '{"address":"HMnQrYxA4fJV8pX8NHK5LPeZxZAeUbpWBmQXpzeva9k9"}'

# 读合约状态
curl -X POST http://127.0.0.1:3080/tools/solana_read_state \
  -H 'Content-Type: application/json' \
  -d '{"programId":"Gw8rwk9w8HNn8Emcgximggy9gtxxQaA7q6hHqboUT8aE","seed":"contra_state"}'
```

---

### 2.2 build-mcp — 全栈构建服务

**部署到服务器：**

```bash
cd agent/mcp/build-mcp
pnpm install && pnpm build

# 配置
mkdir -p ~/.build-mcp
cat > ~/.build-mcp/config.json << 'EOF'
{
  "port": 3081,
  "host": "127.0.0.1",
  "buildDir": "/tmp/build-mcp",
  "maxBuildTimeSec": 600,
  "registries": {
    "dockerhub": "docker.io"
  },
  "historyPath": "/home/ubuntu/.build-mcp/history.jsonl"
}
EOF

sudo cp build-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now build-mcp
```

**前置要求：** Node.js 22+、pnpm、Docker、Git。移动端构建额外需要：Android SDK（`ANDROID_HOME`）、Xcode（macOS）、Flutter SDK。

**注册到 OpenClaw：**

```json5
{
  "tools": {
    "mcpServers": {
      "build": {
        "type": "http",
        "url": "http://<服务器IP>:3081",
        "tools": [
          "build_npm",
          "build_docker",
          "build_mobile",
          "build_status",
          "build_clean",
          "build_disk"
        ]
      }
    }
  }
}
```

**API 路由：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/tools` | 列出所有 tool 及参数 schema |
| `POST` | `/tools/build_npm` | 前端/Node 构建 |
| `POST` | `/tools/build_docker` | Docker 构建推送 |
| `POST` | `/tools/build_mobile` | 移动端构建 |
| `POST` | `/tools/build_status` | 构建历史 |
| `POST` | `/tools/build_clean` | 清理旧产物 |
| `POST` | `/tools/build_disk` | 磁盘占用查询 |
| `GET` | `/health` | 健康检查 |

**Tool 使用示例：**

```bash
# 前端构建
curl -X POST http://127.0.0.1:3081/tools/build_npm \
  -H 'Content-Type: application/json' \
  -d '{
    "repoUrl": "https://github.com/sftgroup/web-app.git",
    "branch": "main",
    "buildCmd": "pnpm build",
    "env": {"VITE_API_URL": "https://api.example.com"}
  }'

# Docker 构建 + 推送
curl -X POST http://127.0.0.1:3081/tools/build_docker \
  -H 'Content-Type: application/json' \
  -d '{
    "repoUrl": "https://github.com/sftgroup/api.git",
    "imageName": "sftgroup/api:v1.2.0",
    "push": true
  }'

# React Native iOS 构建
curl -X POST http://127.0.0.1:3081/tools/build_mobile \
  -H 'Content-Type: application/json' \
  -d '{
    "repoUrl": "https://github.com/sftgroup/mobile.git",
    "platform": "ios",
    "framework": "react-native",
    "scheme": "SFTApp"
  }'

# 查看构建历史
curl -X POST http://127.0.0.1:3081/tools/build_status \
  -H 'Content-Type: application/json' \
  -d '{"limit": 10}'

# 清理超过 2 小时的构建产物
curl -X POST http://127.0.0.1:3081/tools/build_clean \
  -H 'Content-Type: application/json' \
  -d '{"olderThanHours": 2}'

# 查看磁盘占用
curl -X POST http://127.0.0.1:3081/tools/build_disk \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

## 三、能力总览

### skill: solana-anchor

| 类型 | 内容 |
|------|------|
| 知识 | SBF 兼容性 / PDA 设计 / Timelock / SPL Token / Anchor 验证 |
| 脚本 | 编译部署 / 安装工具链 / 读链上状态 |
| 模板 | Anchor 合约骨架 (Rust) / 客户端 (TypeScript) |
| Bug 库 | 6 类速查 + 4 个实战案例 |

### mcp: solana-mcp

| Tool | 说明 |
|------|------|
| `solana_build` | 编译 SBF .so，自动检测 edition2024 兼容性 |
| `solana_deploy` | 升级部署，keypair 集中管理、临时文件用完即删 |
| `solana_read_state` | 读链上 PDA 状态 |
| `solana_verify_tx` | 交易确认 + 日志 |
| `solana_balance` | SOL/SPL 余额查询 |
| `solana_history` | 操作历史审计 |

### mcp: build-mcp

| Tool | 说明 |
|------|------|
| `build_npm` | 前端/Node 构建（Vue/React/Next/Nuxt），monorepo 支持 |
| `build_docker` | Docker 构建 + 推送 |
| `build_mobile` | React Native / Flutter / Expo 构建 |
| `build_status` | 构建历史查询 |
| `build_clean` | 清理旧产物 |
| `build_disk` | 磁盘占用查询 |

---

## 四、安全说明

- **私钥**：solana-mcp 的 keypair 存储在 `~/.solana-mcp/config.json` 引用的路径，部署时使用临时文件（chmod 600），用完立即删除，不会出现在进程列表或日志中
- **网络**：MCP 服务绑定 127.0.0.1，生产环境通过 Nginx 反代 + IP 白名单暴露
- **隔离**：build-mcp 所有构建在 `/tmp/build-mcp/` 下隔离执行，互不干扰
- **审计**：所有部署和构建操作写入 JSONL 历史文件，可通过 `solana_history` 和 `build_status` 查询
