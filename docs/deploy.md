# MCP 部署文档

**服务器：** 43.156.46.187  |  **系统：** Ubuntu 24.04  |  **用户：** ubuntu

---

## 已部署服务

| 服务 | 端口 | Tools | systemd 服务名 | 配置路径 |
|------|------|-------|--------------|----------|
| solana-mcp | 3080 | 6 | `solana-mcp` | `~/.solana-mcp/config.json` |
| build-mcp | 3081 | 6 | `build-mcp` | `~/.build-mcp/config.json` |
| git-mcp | 3082 | 18 | `git-mcp` | `~/.git-mcp/config.json` |

所有服务监听 `0.0.0.0`，可直接通过 `http://43.156.46.187:<port>` 访问。

---

## 日常运维

```bash
# 查看状态
sudo systemctl status solana-mcp build-mcp git-mcp

# 重启
sudo systemctl restart solana-mcp build-mcp git-mcp

# 日志
sudo journalctl -u solana-mcp -f
sudo journalctl -u build-mcp  -f
sudo journalctl -u git-mcp    -f

# 健康检查
curl http://43.156.46.187:3080/health
curl http://43.156.46.187:3081/health
curl http://43.156.46.187:3082/health
```

---

## 防火墙

腾讯云安全组需开放 TCP 3080-3082 入站规则。

服务器本地无需额外配置（iptables 默认 ACCEPT）。

---

## 目录结构

```
/opt/mcp/
├── solana-mcp/          # 合约编译部署 (port 3080)
├── build-mcp/           # 全栈构建 (port 3081)
├── git-mcp/             # 代码管理 (port 3082)
└── repos/               # git 管理的代码仓库（git-mcp 数据目录）

~/.solana-mcp/
├── config.json          # solana-mcp 配置
└── history.jsonl        # 操作审计日志

~/.build-mcp/
├── config.json          # build-mcp 配置
└── history.jsonl        # 构建审计日志

~/.git-mcp/
├── config.json          # git-mcp 配置
└── data.db              # SQLite 数据库（仓库/版本/审计/同步状态）
```

---

## 配置说明

### solana-mcp (`~/.solana-mcp/config.json`)

```json
{
  "port": 3080,
  "host": "0.0.0.0",
  "rpcUrl": "https://api.mainnet-beta.solana.com",
  "keypairs": {
    "default": "/home/ubuntu/.config/solana/id.json"
  },
  "projects": {},
  "historyPath": "/home/ubuntu/.solana-mcp/history.jsonl"
}
```

### build-mcp (`~/.build-mcp/config.json`)

```json
{
  "port": 3081,
  "host": "0.0.0.0",
  "buildDir": "/tmp/build-mcp",
  "maxBuildTimeSec": 600,
  "registries": {
    "dockerhub": "docker.io"
  },
  "historyPath": "/home/ubuntu/.build-mcp/history.jsonl"
}
```

### git-mcp (`~/.git-mcp/config.json`)

```json
{
  "port": 3082,
  "host": "0.0.0.0",
  "repoBasePath": "/opt/mcp/repos",
  "dbPath": "/home/ubuntu/.git-mcp/data.db",
  "githubOrg": "sftgroup"
}
```

**GitHub Token：** 需要设置环境变量 `GIT_TOKEN` 才能 push 到 GitHub。编辑 systemd service 文件：

```bash
sudo systemctl edit git-mcp
```

添加：
```
[Service]
Environment=GIT_TOKEN=ghp_xxxxxxxxxxxx
```

然后重启：`sudo systemctl restart git-mcp`

---

## 已安装工具链

| 工具 | 版本 | 路径 |
|------|------|------|
| Node.js | 22.23.1 | `/usr/bin/node` |
| pnpm | 11.10.0 | `~/.npm-global/bin/pnpm` |
| Git | 2.43 | `/usr/bin/git` |
| Solana CLI | 2.3.3 | `~/.local/share/solana/install/active_release/solana-release/bin/solana` |
| SBF rustc | 1.84.1-dev | `~/.cache/solana/v1.48/rust/bin/rustc` |
| cargo build-sbf | 2.3.3 | `~/.cargo/bin/cargo build-sbf` |
| Docker | 29.6.1 + buildx | `/usr/bin/docker` |
| Flutter | 3.44.5 | `~/flutter/` |
| Android SDK | 34 + tools 34.0.0 + platform-tools 37 | `~/android-sdk/` |
| Java | OpenJDK 17 | `/usr/lib/jvm/java-17-openjdk-amd64/` |
| Expo | CLI | `npx expo` |

## systemd 环境变量

### solana-mcp
```
PATH=~/.local/share/solana/install/active_release/solana-release/bin:~/.cargo/bin:~/.npm-global/bin:...
```

### build-mcp
```
PATH=~/.npm-global/bin:~/.cargo/bin:~/flutter/bin:~/android-sdk/cmdline-tools/latest/bin:~/android-sdk/platform-tools:...
ANDROID_HOME=/home/ubuntu/android-sdk
ANDROID_SDK_ROOT=/home/ubuntu/android-sdk
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
DOCKER_HOST=unix:///var/run/docker.sock
```

### git-mcp
```
PATH=~/.npm-global/bin:...
# GIT_TOKEN 需要通过 sudo systemctl edit git-mcp 添加
```

## 磁盘

178G 总量，当前使用 ~16G。
