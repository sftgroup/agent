/**
 * Solana MCP Server — HTTP entry point
 *
 * Uses Express for HTTP transport. Each tool is exposed as POST /mcp with
 * JSON-RPC style payload: { "tool": "solana_build", "input": {...} }
 *
 * This keeps it simple for nginx reverse-proxy deployment and avoids
 * the complexity of Streamable HTTP session management.
 */

import express from "express";
import { loadConfig, getActiveRpcCount } from "./config.js";
import { build } from "./tools/build.js";
import { deploy } from "./tools/deploy.js";
import { readState } from "./tools/readState.js";
import { verifyTx } from "./tools/verifyTx.js";
import { balance } from "./tools/balance.js";
import { history } from "./tools/history.js";

const cfg = loadConfig();
const app = express();
app.use(express.json());

// ─── Tool Registry ────────────────────────────────────

type ToolHandler = (input: any) => Promise<Record<string, any>>;

// biome-ignore lint/suspicious/noExplicitAny: accept any input shape, validated at runtime
const tools: Record<string, { handler: ToolHandler; description: string; schema: Record<string, any> }> = {
  solana_build: {
    handler: build,
    description: "Compile SBF .so from project source. Auto-detects edition2024 incompatibility.",
    schema: {
      projectDir: { type: "string", optional: true, description: "Absolute path to project directory" },
      projectName: { type: "string", optional: true, description: "Key from config.projects" },
      edition: { type: "enum", values: ["2021", "2024"], optional: true, description: "Rust edition" },
      options: { type: "string", optional: true, description: "Extra cargo build-sbf flags" },
    },
  },
  solana_deploy: {
    handler: deploy,
    description: "Deploy/upgrade a Solana program. Keypair managed server-side, never exposed.",
    schema: {
      soPath: { type: "string", description: "Absolute path to .so file" },
      programId: { type: "string", description: "Solana program ID" },
      keypairName: { type: "string", optional: true, description: "Keypair name from config.keypairs" },
      network: { type: "string", optional: true, description: "RPC URL or network alias" },
    },
  },
  solana_read_state: {
    handler: readState,
    description: "Read on-chain PDA state for a program.",
    schema: {
      programId: { type: "string", description: "Program ID" },
      seed: { type: "string", optional: true, description: "PDA seed (default: 'state')" },
      network: { type: "string", optional: true, description: "RPC URL" },
    },
  },
  solana_verify_tx: {
    handler: verifyTx,
    description: "Confirm and inspect a Solana transaction by signature.",
    schema: {
      signature: { type: "string", description: "Transaction signature" },
      network: { type: "string", optional: true, description: "RPC URL" },
    },
  },
  solana_balance: {
    handler: balance,
    description: "Check SOL/SPL balances. Defaults to server's default keypair address.",
    schema: {
      address: { type: "string", optional: true, description: "Solana address" },
      network: { type: "string", optional: true, description: "RPC URL" },
    },
  },
  solana_history: {
    handler: history,
    description: "View server-side deploy/build history. Filter by program ID.",
    schema: {
      programId: { type: "string", optional: true, description: "Filter by program ID" },
      limit: { type: "number", optional: true, description: "Max entries (default: 50)" },
    },
  },
};

// ─── Routes ────────────────────────────────────────────

// Tool discovery
app.get("/tools", (_req, res) => {
  const list = Object.entries(tools).map(([name, t]) => ({
    name,
    description: t.description,
    schema: t.schema,
  }));
  res.json({ tools: list });
});

// Tool execution
app.post("/tools/:name", async (req, res) => {
  const { name } = req.params;
  const tool = tools[name];
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

// Health check
// ─── MCP JSON-RPC (Standard Protocol) ──────────────────

app.post("/mcp", async (req, res) => {
  const { jsonrpc, method, params, id } = req.body ?? {};
  const send = (r: any) => res.json({ jsonrpc: "2.0", result: r, id });
  const fail = (c: number, m: string) => res.json({ jsonrpc: "2.0", error: { code: c, message: m }, id });

  if (method === "initialize")
    return send({ protocolVersion: "2024-11-05", serverInfo: { name: "solana-mcp", version: "1.0" }, capabilities: { tools: {} } });
  if (method === "tools/list") {
    const list = Object.entries(tools).map(([name, t]) => ({ name, description: t.description }));
    return send({ tools: list });
  }
  if (method === "tools/call") {
    const tool = tools[params?.name];
    if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
    try {
      const result = await tool.handler(params?.arguments ?? {});
      return send({ content: [{ type: "text", text: JSON.stringify(result) }] });
    } catch (e: any) { return fail(-32000, e.message); }
  }
  if (method === "notifications/initialized")
    return res.json({ jsonrpc: "2.0", id });
  return fail(-32601, `Unknown method: ${method}`);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    tools: Object.keys(tools).length,
    rpcUrl: getActiveRpcCount() + " of " + (cfg.rpcUrls ?? [cfg.rpcUrl]).length + " alive",
    keypairs: Object.keys(cfg.keypairs).length,
    projects: Object.keys(cfg.projects).length,
  });
});

// ─── Start ─────────────────────────────────────────────

app.listen(cfg.port, cfg.host, () => {
  console.log(`🧂 Solana MCP v0.1.0 — http://${cfg.host}:${cfg.port}`);
  console.log(`   GET  /tools          — list tools`);
  console.log(`   POST /tools/:name     — execute tool`);
  console.log(`   GET  /health          — health check`);
  console.log(`   RPC: ${cfg.rpcUrl}`);
  console.log(`   Keypairs: ${Object.keys(cfg.keypairs).join(", ") || "(none)"}`);
  console.log(`   Projects: ${Object.keys(cfg.projects).join(", ") || "(none)"}`);
});
