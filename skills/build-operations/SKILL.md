---
name: build-operations
description: "Centralized build workflow via build-mcp. Agent must use MCP tools for all npm/docker/mobile builds."
user-invocable: true
metadata: { "openclaw": { "os": ["linux"] } }
---

# Build Operations — Centralized Build Service

> All builds must go through the build-mcp server. Never run `pnpm build` / `docker build` / `gradle` / `xcodebuild` directly.
> The MCP server provides isolated, auditable, and reproducible builds.

---

## When to Use Each Tool

| Situation | Tool | Why |
|-----------|------|-----|
| Frontend / Node.js build | `build_npm` | Vue/React/Next/Nuxt + monorepo. Specs: pnpm, npm, yarn, bun. |
| Docker image build + push | `build_docker` | Build + tag + push to any registry. |
| Mobile app build | `build_mobile` | React Native (iOS/Android), Flutter, Expo. |
| Check build history | `build_status` | See what was built, when, by whom, with what result. |
| Clean old artifacts | `build_clean` | Delete builds older than N hours or by specific ID. |
| Check disk usage | `build_disk` | Workspace disk consumption, build count, age range. |

---

## Build Workflow (MANDATORY)

**Before any build, the agent must:**

```
Step 1: git_pull       — Ensure code is current (via git-mcp)
Step 2: git_push       — Ensure changes are committed (via git-mcp)
Step 3: git_sync       — Ensure code is on GitHub (via git-mcp)
Step 4: build_*        — Trigger the build
Step 5: build_status   — Confirm the build succeeded
```

**Never build code that isn't committed and synced.** Code built against a dirty working tree has no traceable source — you can't reproduce it or debug it later.

### Frontend Build

```
POST /tools/build_npm {
  "repoUrl": "https://github.com/sftgroup/web-app.git",
  "branch": "main",
  "buildCmd": "pnpm build",
  "buildDir": "packages/frontend",
  "env": { "VITE_API_URL": "https://api.example.com" }
}
→ { ok: true, buildId: "npm-<uuid>", artifactPath: "/tmp/build-mcp/npm-<uuid>/dist", ... }
```

Tools detected: `pnpm`, `npm`, `yarn`, `bun`. Monorepo support via `buildDir`.

### Docker Build

```
POST /tools/build_docker {
  "repoUrl": "https://github.com/sftgroup/api.git",
  "imageName": "sftgroup/api:v1.2.0",
  "push": true,
  "registry": "dockerhub"
}
→ { ok: true, buildId: "docker-<uuid>", imageName: "sftgroup/api:v1.2.0", ... }
```

### Mobile Build

```
POST /tools/build_mobile {
  "repoUrl": "https://github.com/sftgroup/mobile.git",
  "platform": "ios",
  "framework": "react-native",
  "buildType": "release",
  "scheme": "SFTApp"
}
→ { ok: true, buildId: "mobile-<uuid>", artifacts: ["SFTApp.ipa"], ... }
```

---

## Build Environment

| Aspect | Details |
|--------|---------|
| **Isolation** | Each build runs in `/tmp/build-mcp/<type>-<uuid>/`. No cross-contamination. |
| **Node.js** | pnpm 9+ preferred. Falls back to npm → yarn → bun. |
| **Docker** | BuildKit enabled. Supports multi-platform (linux/amd64, linux/arm64). |
| **Android** | Requires `ANDROID_HOME` set. Uses Gradle wrapper. |
| **iOS** | Requires Xcode on macOS build server. Uses xcodebuild + archive. |
| **Flutter** | Requires Flutter SDK in PATH. Detects from `pubspec.yaml`. |
| **Expo** | Requires `EXPO_TOKEN` env var. Uses EAS Build or local `expo build`. |

---

## NEVER Do These

- ❌ Run `pnpm build`, `npm run build`, `yarn build` directly via exec
- ❌ Run `docker build` or `docker push` directly
- ❌ Run `./gradlew assembleRelease` or `xcodebuild` directly
- ❌ Build code that isn't committed + synced to GitHub
- ❌ Build in the project directory (use build-mcp's isolated workspace)
- ❌ Leave builds accumulating — run `build_clean` periodically

---

## Troubleshooting

| Problem | Action |
|---------|--------|
| Build failed | Check `build_status` for error output from the failed build |
| "No space left on device" | Run `build_disk` to check usage, then `build_clean` to free space |
| "Toolchain not found" | Verify build server dependencies: Node 22+, Docker, pnpm |
| Mobile build failed | Check `ANDROID_HOME` (Android) or Xcode version (iOS) |
| Docker push failed | Check `registries` config in `~/.build-mcp/config.json` |

---

## Periodic Maintenance

```
# Check disk usage weekly
POST /tools/build_disk  {}

# Clean builds older than 48 hours
POST /tools/build_clean  { "olderThanHours": 48 }
```

## MCP Server URL

The build-mcp server is at `http://<server>:3081`. All tools accessible via `POST /tools/:name`.
