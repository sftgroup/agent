/**
 * Build MCP Server — Universal build service
 *
 * Tools:
 *   build_npm    — npm/pnpm/yarn frontend + Node backend
 *   build_docker  — Docker image build + push
 *   build_mobile  — React Native / Flutter / Expo
 *   build_status  — build history & status
 */

import express from "express";
import { loadConfig } from "./config.js";
import { buildNpm } from "./tools/buildNpm.js";
import { buildDocker } from "./tools/buildDocker.js";
import { buildMobile } from "./tools/buildMobile.js";
import { buildStatus } from "./tools/status.js";

const cfg = loadConfig();
const app = express();
app.use(express.json({ limit: "5mb" }));

// ─── Tool Registry ────────────────────────────────

const tools = {
  build_npm: {
    handler: async (input: any) => buildNpm(input),
    description: "Build frontend or Node.js backend project. Clone → install → build → return artifact dist/.",
    schema: {
      repoUrl: "string (required) - git clone URL",
      branch: "string - git branch (default: main)",
      installCmd: "string - install command (default: pnpm install --frozen-lockfile)",
      buildCmd: "string - build command (default: pnpm build)",
      buildDir: "string - subdirectory for monorepo (default: repo root)",
      nodeVersion: "string - node version (default: 22)",
      env: "object - extra env vars (e.g. VITE_API_URL)",
    },
  },
  build_docker: {
    handler: async (input: any) => buildDocker(input),
    description: "Build and optionally push Docker image. Clone → docker build → docker push.",
    schema: {
      repoUrl: "string (required) - git clone URL",
      branch: "string - git branch (default: main)",
      dockerfile: "string - Dockerfile path (default: Dockerfile)",
      imageName: "string (required) - full image name with tag",
      buildArgs: "object - docker build-args",
      push: "boolean - push after build (default: true)",
      registry: "string - key from config.registries",
      platform: "string - target platform (default: linux/amd64)",
    },
  },
  build_mobile: {
    handler: async (input: any) => buildMobile(input),
    description: "Build mobile app: React Native (iOS/Android), Flutter, Expo. Returns artifact paths.",
    schema: {
      repoUrl: "string (required) - git clone URL",
      branch: "string - git branch (default: main)",
      platform: "string (required) - ios | android | both",
      framework: "string (required) - react-native | flutter | expo",
      buildType: "string - debug | release (default: release)",
      scheme: "string - iOS scheme name",
      buildDir: "string - monorepo subdirectory",
      env: "object - extra env vars (e.g. EXPO_TOKEN)",
    },
  },
  build_status: {
    handler: async (input: any) => buildStatus(input),
    description: "Check build history and status. Filter by build ID or get recent N.",
    schema: {
      buildId: "string - specific build ID to query",
      limit: "number - recent N builds (default: 30)",
    },
  },
};

// ─── Routes ──────────────────────────────────────────

app.get("/tools", (_req, res) => {
  const list = Object.entries(tools).map(([name, t]) => ({
    name,
    description: t.description,
    schema: t.schema,
  }));
  res.json({ tools: list });
});

app.post("/tools/:name", async (req, res) => {
  const { name } = req.params;
  const tool = tools[name as keyof typeof tools];
  if (!tool) {
    res.status(404).json({ error: `Unknown tool: ${name}`, availableTools: Object.keys(tools) });
    return;
  }

  const start = Date.now();
  try {
    const result = await tool.handler(req.body ?? {});
    res.json({ ok: true, tool: name, durationMs: Date.now() - start, ...result });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      tool: name,
      durationMs: Date.now() - start,
      error: e.message,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    tools: Object.keys(tools).length,
    buildDir: cfg.buildDir,
  });
});

// ─── Start ───────────────────────────────────────────

app.listen(cfg.port, cfg.host, () => {
  console.log(`🔧 Build MCP v0.1.0 — http://${cfg.host}:${cfg.port}`);
  console.log(`   GET  /tools                   — list tools`);
  console.log(`   POST /tools/build_npm         — frontend / Node.js`);
  console.log(`   POST /tools/build_docker      — Docker image`);
  console.log(`   POST /tools/build_mobile      — React Native / Flutter / Expo`);
  console.log(`   POST /tools/build_status      — build history`);
  console.log(`   Build workspace: ${cfg.buildDir}`);
});
