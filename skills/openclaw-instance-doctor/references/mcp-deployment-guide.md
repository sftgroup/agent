# MCP Server 部署规范

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 43.156.46.187 |
| 用户 | ubuntu |
| 密码 | Asdf1234! |
| OS | Ubuntu 24.04 LTS |
| 目录根 | /opt/mcp |

## 架构

```
teamN ──MCP tool call──→ MCP Server ──SSH──→ target machine ──run linter──→ return
```

所有 MCP 工具采用 SSH 代理模式：MCP 服务器通过 sshpass 连到目标机器执行命令，不需要目标机器安装额外服务。

## 端口分配

| 端口 | 服务 | 状态 |
|------|------|------|
| **9001** | **agent-review** | ✅ 运行中（v2.0 SSH proxy） |

## 目录规范

```
/opt/mcp/
├── agent-review/
│   └── server.py          ← MCP 实现
├── (service-name)/
│   └── server.py           ← 每个 MCP 一个目录
```

## systemd 规范

| 规则 | 示例 |
|------|------|
| 服务名 | `<name>-mcp.service` |
| 用户 | ubuntu |
| 重启策略 | always, 5s |
| 日志 | journal |

```ini
[Unit]
Description=<描述> (:90XX)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/mcp/<service-dir>
ExecStart=/usr/bin/python3 /opt/mcp/<service-dir>/server.py 90XX
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 部署命令

```bash
# 1. 上传
scp server.py ubuntu@43.156.46.187:/opt/mcp/<service-dir>/server.py

# 2. 创建 systemd
ssh ubuntu@43.156.46.187 "sudo tee /etc/systemd/system/<name>-mcp.service << 'EOF'
... service file content ...
EOF"

# 3. 启动
ssh ubuntu@43.156.46.187 "sudo systemctl daemon-reload && sudo systemctl enable <name>-mcp && sudo systemctl start <name>-mcp"

# 4. 验证
curl http://43.156.46.187:90XX/health
```

## OpenClaw 侧配置

```json
{
  "mcp": {
    "servers": {
      "<name>": {
        "command": "http",
        "args": ["http://43.156.46.187:90XX/mcp"],
        "transport": "streamable-http"
      }
    }
  }
}
```

## 已部署服务

| 端口 | 服务名 | systemd unit | 模式 | 描述 |
|------|--------|-------------|------|------|
| 9001 | agent-review | agent-review-mcp.service | SSH proxy | 代码质量：lint/format/types/complexity/deps，6 tools |

## 安全组清单

| 端口 | 协议 | 来源 | 状态 |
|------|------|------|------|
| 9001 | TCP | 0.0.0.0/0 | ✅ 已放行 |
