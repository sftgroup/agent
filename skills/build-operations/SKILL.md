---
name: build-operations
description: "Centralized build workflow via build-mcp. Agent must use MCP tools for all npm/docker/mobile builds."
user-invocable: true
metadata: { "openclaw": { "os": ["linux"] } }
---

# Build Operations — Centralized Build via build-mcp

> All builds must go through build-mcp. Never run `pnpm build` / `docker build` / `gradle` / `xcodebuild` directly.
> MCP provides isolated, auditable, reproducible builds.

## MCP Dependency

| Item | Value |
|------|-------|
| **MCP server** | build-mcp |
| **URL** | `http://<server>:3081` |
| **Git dependency** | This skill calls git-mcp tools for pre-build checks |
| **Git MCP tools used** | `git_pull`, `git_push`, `git_sync` (from git-mcp) |
| **All build tools below** | call via OpenClaw MCP protocol |

---

## Tool Reference

| Tool | Purpose | Key params |
|------|---------|------------|
| `build_npm` | Frontend / Node.js | `repoUrl`, `branch`, `buildCmd`, `buildDir`(optional) |
| `build_docker` | Docker image | `repoUrl`, `imageName`, `push`, `registry` |
| `build_mobile` | RN / Flutter / Expo | `repoUrl`, `platform`, `framework`, `buildType` |
| `build_status` | Build history | `buildId`(optional), `limit` |
| `build_clean` | Clean old artifacts | `olderThanHours`, `buildId`(optional) |
| `build_disk` | Disk usage | none |

---

## Build Workflow (MANDATORY)

### Pre-Build Checklist

Before ANY build, run these with **git-mcp**:

```
1. git_pull("name")       — Pull latest code (via git-mcp)
2. git_push("name", ...)  — Commit changes if dirty (via git-mcp)
3. git_sync("name")       — Push to GitHub so build has traceable source
```

**Never build code that isn't committed + synced to GitHub.** Code from a dirty tree can't be reproduced.

### One-Shot Build

```
# Frontend
build_npm(repoUrl="https://github.com/sftgroup/web-app.git", branch="main",
          buildCmd="pnpm build", env={VITE_API_URL: "https://api.example.com"})

# Docker
build_docker(repoUrl="https://github.com/sftgroup/api.git", buildDir=".",
             imageName="sftgroup/api:v1.2.0", push=true)

# Mobile
build_mobile(repoUrl="https://github.com/sftgroup/mobile.git",
             platform="ios", framework="react-native", scheme="SFTApp")
```

### After Build

| Action | Tool |
|--------|------|
| Verify build succeeded | `build_status(limit=1)` |
| Get artifact path | returned in build result as `artifactPath` |
| Clean up if build failed | `build_clean(buildId="the-failed-id")` |
| Check disk after many builds | `build_disk()` |
| Periodic cleanup | `build_clean(olderThanHours=48)` |

---

## Build Environment

| Type | Isolation | Toolchain |
|------|-----------|-----------|
| **npm** | `/tmp/build-mcp/npm-<id>/` | pnpm 9+ preferred. Falls back npm→yarn→bun |
| **docker** | `/tmp/build-mcp/docker-<id>/` | Docker BuildKit, linux/amd64+arm64 |
| **mobile** | `/tmp/build-mcp/mobile-<id>/` | Android: `ANDROID_HOME` + Gradle<br>iOS: Xcode + xcodebuild<br>Flutter: SDK in PATH<br>Expo: `EXPO_TOKEN` env |

---

## NEVER Do These

- ❌ Run `pnpm build` / `npm run build` / `yarn build` directly via exec
- ❌ Run `docker build` or `docker push` directly
- ❌ Run `./gradlew assembleRelease` or `xcodebuild` directly
- ❌ Build code that isn't committed + synced to GitHub
- ❌ Build in project directory — use build-mcp's isolated workspace
- ❌ Leave builds accumulating — run `build_clean` periodically

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Build failed | `build_status(limit=5)` — read error output |
| No disk space | `build_disk()` → `build_clean(olderThanHours=1)` |
| Toolchain missing | Verify build server: Node 22+, Docker, pnpm |
| Mobile failed | Android: check `ANDROID_HOME`. iOS: Xcode version. Flutter: SDK in PATH |
| Docker push failed | Verify `registries` in `~/.build-mcp/config.json` |
