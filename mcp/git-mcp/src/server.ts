/**
 * Git MCP Server — Centralized git operations with integrity checks
 *
 * Tools:
 *   repo_register     — register a repo
 *   repo_list         — list/search repos
 *   repo_info         — repo details + latest tag
 *   git_create_repo   — create repo on GitHub
 *   git_clone         — clone repo locally
 *   git_pull          — pull (checks for dirty state)
 *   git_push          — push (auto-pull → integrity check → commit → push)
 *   git_status        — working tree status
 *   git_tags          — list version tags
 *   git_create_tag   — create & push version tag
 *   git_log           — commit history
 *   git_checkout      — switch branch/tag
 *   repo_check        — code integrity check
 */

import express from "express";
import { loadConfig } from "./config.js";
import { getDb } from "./db.js";
import {
  apiRegisterRepo,
  apiListRepos,
  apiGetRepo,
  apiCreateGithubRepo,
  apiClone,
  apiPull,
  apiPush,
  apiStatus,
  apiCreateTag,
  apiListTags,
  apiLog,
  apiLogAudit,
  apiCheckout,
  apiCheck,
  apiSync,
  apiSyncStatus,
  apiSyncCode,
  apiSnapshot,
} from "./tools/gitOps.js";

const cfg = loadConfig();
const app = express();
app.use(express.json({ limit: "5mb" }));

// ─── Tool Registry ────────────────────────────────────

const tools: Record<
  string,
  {
    handler: (input: any) => Promise<any>;
    description: string;
    schema: Record<string, string>;
  }
> = {
  repo_register: {
    handler: apiRegisterRepo,
    description: "Register a code repository in the local database.",
    schema: {
      name: "string (required) - unique repo name (e.g. contra-ai)",
      github_url: "string (required) - GitHub URL",
      default_branch: "string - default branch (default: master)",
      description: "string - repo description",
      tags: "string - comma-separated tags",
      guard_config:
        "JSON string - integrity check config (checkCmd, lintCmd, guardFiles, contracts)",
    },
  },
  repo_list: {
    handler: apiListRepos,
    description:
      "List all registered repositories. Optional keyword search across name/description/tags.",
    schema: { search: "string - keyword search" },
  },
  repo_info: {
    handler: apiGetRepo,
    description:
      "Get detail for one repository: metadata, latest tag, all tags.",
    schema: { name: "string (required) - repo name" },
  },
  git_create_repo: {
    handler: apiCreateGithubRepo,
    description:
      "Create a new GitHub repository and register locally in one step.",
    schema: {
      name: "string (required)",
      description: "string",
      private: "boolean",
    },
  },
  git_clone: {
    handler: apiClone,
    description:
      "Clone a registered repo locally. If already cloned, pulls latest instead.",
    schema: { name: "string (required)", branch: "string" },
  },
  git_pull: {
    handler: apiPull,
    description: "Pull latest from remote. Refuses if working tree is dirty.",
    schema: { name: "string (required)", branch: "string" },
  },
  git_push: {
    handler: apiPush,
    description:
      "Stage all changes, run integrity checks, commit, and push. Use force=true to bypass failed checks.",
    schema: {
      name: "string (required)",
      message: "string (required) - commit message",
      branch: "string",
      files: "string[] - specific files to stage",
      force: "boolean",
      skipChecks: "boolean",
    },
  },
  git_status: {
    handler: apiStatus,
    description:
      "Show working tree status: branch, dirty files, staged/unstaged/untracked counts.",
    schema: { name: "string (required)" },
  },
  git_tags: {
    handler: apiListTags,
    description: "List version tags for a repo.",
    schema: { name: "string (required)" },
  },
  git_create_tag: {
    handler: apiCreateTag,
    description: "Create and push a version tag (e.g. v1.2.0).",
    schema: {
      name: "string (required)",
      tag: "string (required)",
      description: "string",
    },
  },
  git_log: {
    handler: apiLog,
    description: "Show recent commit history.",
    schema: { name: "string (required)", limit: "number (default: 20)" },
  },
  git_audit: {
    handler: apiLogAudit,
    description:
      "View the audit log: who pushed/pulled/cloned/tagged, when, and with what checks.",
    schema: { name: "string - filter by repo", limit: "number (default: 50)" },
  },
  git_checkout: {
    handler: apiCheckout,
    description: "Switch branch or tag. Refuses if working tree is dirty.",
    schema: {
      name: "string (required)",
      ref: "string (required) - branch or tag name",
    },
  },
  repo_check: {
    handler: apiCheck,
    description:
      "Run code integrity checks: compile, lint, test, guardFiles, contract verification.",
    schema: { name: "string (required)", branch: "string" },
  },
  git_sync: {
    handler: apiSync,
    description:
      "Push MCP-local commits to GitHub. Use after git_push confirms unsynced commits.",
    schema: {
      name: "string (required)",
      branch: "string",
      tag: "string — create a version tag after sync",
    },
  },
  git_sync_status: {
    handler: apiSyncStatus,
    description:
      "Check which repos have unsynced local commits not yet pushed to GitHub.",
    schema: { name: "string — specific repo, or omit for all repos" },
  },
  repo_sync: {
    handler: apiSyncCode,
    description:
      "Sync code from a test/team server to MCP. Returns snapshot SHA for code review traceability.",
    schema: {
      team: "string (required) — team identifier (e.g. team3)",
      source_host: "string (required) — server IP",
      source_path: "string (required) — absolute path on source",
    },
  },
  repo_snapshot: {
    handler: apiSnapshot,
    description:
      "Get current snapshot SHA for a team without re-syncing. Use for code review report traceability.",
    schema: { team: "string (required) — team identifier" },
  },
};

// ─── Routes ────────────────────────────────────────────

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
  const tool = tools[name];
  if (!tool) {
    res.status(404).json({
      error: `Unknown tool: ${name}`,
      availableTools: Object.keys(tools),
    });
    return;
  }

  const start = Date.now();
  try {
    const result = await tool.handler(req.body ?? {});
    res.json({
      ok: true,
      tool: name,
      durationMs: Date.now() - start,
      ...result,
    });
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
    db: cfg.dbPath,
  });
});

// Initialize DB
getDb();

app.listen(cfg.port, cfg.host, () => {
  console.log(`🔀 Git MCP v0.1.0 — http://${cfg.host}:${cfg.port}`);
  console.log(
    `   Tools: ${Object.keys(tools).length} (repo_register, repo_list, git_clone, git_pull, git_push, git_status, git_tags, git_log, git_checkout, repo_check + more)`,
  );
  console.log(`   DB: ${cfg.dbPath}`);
  console.log(`   Repo path: ${cfg.repoBasePath}`);
});
