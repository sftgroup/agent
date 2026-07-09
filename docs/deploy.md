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
