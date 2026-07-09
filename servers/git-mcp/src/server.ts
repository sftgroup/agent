import express from "express";
import { loadConfig } from "./config.js";
import {
  apiRegisterRepo, apiListRepos, apiGetRepo, apiCreateGithubRepo,
  apiClone, apiPull, apiPush, apiSync, apiSyncStatus,
  apiStatus, apiListTags, apiCreateTag, apiLog, apiLogAudit,
  apiCheckout, apiCheck,
  apiSyncCode, apiSnapshot, apiRepoPull,
} from "./tools/gitOps.js";

const cfg = loadConfig();
const app = express();
app.use(express.json({ limit: "5mb" }));

const tools: Record<string, any> = {
  repo_register:   { handler: apiRegisterRepo,   description: "Register a GitHub repo for git-mcp" },
  repo_list:       { handler: apiListRepos,      description: "List all registered repos" },
  repo_info:       { handler: apiGetRepo,        description: "Get repo details" },
  git_create_repo: { handler: apiCreateGithubRepo, description: "Create GitHub repo" },
  git_clone:       { handler: apiClone,          description: "Clone a registered repo" },
  git_pull:        { handler: apiPull,           description: "Pull latest from GitHub" },
  git_push:        { handler: apiPush,           description: "Commit to MCP local repo" },
  git_sync:        { handler: apiSync,           description: "Push MCP-local to GitHub" },
  git_sync_status: { handler: apiSyncStatus,     description: "Check unsynced commits" },
  git_status:      { handler: apiStatus,         description: "Repo working tree status" },
  git_tags:        { handler: apiListTags,           description: "List tags" },
  git_create_tag:  { handler: apiCreateTag, description: "Create a tag" },
  git_log:         { handler: apiLog,            description: "Commit log" },
  git_audit:       { handler: apiLogAudit,          description: "Audit trail" },
  git_checkout:    { handler: apiCheckout,       description: "Switch branch" },
  repo_check:      { handler: apiCheck,          description: "Pre-push integrity check" },
  repo_sync:       { handler: apiSyncCode,       description: "Sync code from test server" },
  repo_snapshot:   { handler: apiSnapshot,       description: "Get snapshot SHA" },
  repo_pull:       { handler: apiRepoPull,       description: "Pull from test server + commit + push" },
};

// MCP JSON-RPC Handler
async function mcpHandler(req: any, res: any) {
  const { jsonrpc, method, params, id } = req.body ?? {};
  const send = (r: any) => res.json({ jsonrpc: "2.0", result: r, id });
  const fail = (c: number, m: string) => res.json({ jsonrpc: "2.0", error: { code: c, message: m }, id });
  if (method === "initialize") return send({ protocolVersion: "2024-11-05", serverInfo: { name: "git-mcp", version: "1.0" }, capabilities: { tools: {} } });
  if (method === "tools/list") { const list = Object.entries(tools).map(([n, t]) => ({ name: n, description: (t as any).description, inputSchema: { type: "object", properties: {} } })); return send({ tools: list }); }
  if (method === "tools/call") { const tool = tools[params?.name]; if (!tool) return fail(-32602, "Unknown tool: " + params?.name); try { const result = await tool.handler(params?.arguments ?? {}); return send({ content: [{ type: "text", text: JSON.stringify(result) }] }); } catch (e: any) { return fail(-32000, e.message); } }
  if (method === "notifications/initialized") return res.json({ jsonrpc: "2.0", id });
  return fail(-32601, "Unknown method: " + method);
}
app.post("/", mcpHandler);
app.post("/mcp", mcpHandler);

app.get("/tools", (_req, res) => { const list = Object.entries(tools).map(([n, t]) => ({ name: n, description: (t as any).description, inputSchema: { type: "object", properties: {} } })); res.json({ tools: list }); });
app.post("/tools/:name", async (req, res) => { const tool = tools[req.params.name]; if (!tool) { res.status(404).json({ error: "Not found" }); return; } try { const r = await tool.handler(req.body ?? {}); res.json({ ok: true, tool: req.params.name, ...r }); } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); } });
app.get("/health", (_req, res) => { res.json({ status: "ok", timestamp: new Date().toISOString(), tools: Object.keys(tools).length }); });

app.listen(cfg.port, cfg.host, () => { console.log(`git-mcp on http://${cfg.host}:${cfg.port}`); });
