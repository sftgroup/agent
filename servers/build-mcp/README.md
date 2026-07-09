# Build MCP — 全栈构建服务

> Skill（构建规范）+ MCP（隔离构建 + 审计）双层架构

---

## 这是什么

所有 OpenClaw agent 的统一构建入口：

- **Skill** — 教 agent 构建前必须做什么（提交代码 → 同步 → 再构建），构建后怎么处理产物
- **build-mcp** — 隔离执行 npm/docker/mobile 构建，所有产物在 `/tmp/build-mcp/` 下互不干扰

---

## 核心设计

```
agent → git-mcp (git_pull → git_push → git_sync) → build-mcp (build_*) → 产物
                                                      ↑
                                               代码必须已提交+同步，
                                               构建在隔离目录执行，
                                               不会污染项目目录
```

**三个关键点：**
1. **构建前必须同步代码** — 不构建未提交/未同步的代码（git-mcp 强制）
2. **完全隔离** — 每次构建在 `/tmp/build-mcp/<type>-<uuid>/`，互不干扰
3. **可审计** — `build_status` 查看历史，`build_clean` 自动清理

---

## 文件结构

```
skills/build-operations/
└── SKILL.md                        # Skill 主文档

mcp/build-mcp/
├── src/
│   ├── server.ts                   # Express HTTP 服务器
│   ├── config.ts                   # 配置管理
│   └── tools/
│       ├── buildNpm.ts             # 前端/Node.js 构建
│       ├── buildDocker.ts          # Docker 构建+推送
│       ├── buildMobile.ts          # React Native / Flutter / Expo
│       ├── status.ts              # 构建历史查询
│       └── clean.ts               # 清理 + 磁盘占用
├── package.json
├── tsconfig.json
└── build-mcp.service               # systemd 配置
```

---

## 工具清单（6 个）

| 工具 | 干什么 | 支持 |
|------|--------|------|
| `build_npm` | 前端/Node 构建 | pnpm / npm / yarn / bun，monorepo 支持 |
| `build_docker` | Docker 镜像 | BuildKit，linux/amd64+arm64，多 registry |
| `build_mobile` | 移动端构建 | React Native(iOS+Android) / Flutter / Expo |
| `build_status` | 构建历史 | 按 Build ID 查或看最近 N 条 |
| `build_clean` | 清理产物 | 按时间（>N 小时）或指定 Build ID |
| `build_disk` | 磁盘占用 | 工作区大小、构建数量、最早/最新构建时间 |

---

## 使用流程

```
# agent 想构建 →

1. 检查代码是否已提交同步（git-mcp）
   git_pull → git_push → git_sync

2. 触发构建
   build_npm(repoUrl="https://github.com/sftgroup/web-app.git",
             buildCmd="pnpm build", env={VITE_API_URL: "..."})
   → { ok: true, buildId: "npm-abc123", artifactPath: "/tmp/build-mcp/npm-abc123/dist" }

3. 验证
   build_status(limit=1)
   → { ok: true, status: "ok", artifact: "dist/", sizeBytes: 245000 }

4. 产物在 artifactPath，可以继续部署或分发
```

---

## 部署

```bash
cd mcp/build-mcp
pnpm install && pnpm build

mkdir -p ~/.build-mcp
cat > ~/.build-mcp/config.json << 'EOF'
{
  "port": 3081, "host": "127.0.0.1",
  "buildDir": "/tmp/build-mcp",
  "maxBuildTimeSec": 600,
  "registries": { "dockerhub": "docker.io" }
}
EOF

sudo cp build-mcp.service /etc/systemd/system/
sudo systemctl enable --now build-mcp
curl http://127.0.0.1:3081/health
```

**前置要求：**
- 基础：Node.js 22+、pnpm、Git
- Docker 构建：Docker 20+
- Android 构建：Android SDK + `ANDROID_HOME` 环境变量
- iOS 构建：macOS + Xcode
- Flutter：Flutter SDK 在 PATH
- Expo：`EXPO_TOKEN` 环境变量

---

## Skill 安装

```bash
openclaw skills install git:sftgroup/agent@master#skills/build-operations --as build-operations
```
