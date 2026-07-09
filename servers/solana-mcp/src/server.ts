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
app.use(express.json({ limit: "5mb" }));

const tools: Record<string, any> = {
  solana_build:      { handler: build,      description: "Compile Solana program to SBF" },
  solana_deploy:     { handler: deploy,  description: "Deploy/upgrade on-chain program" },
  solana_read_state: { handler: readState,     description: "Read PDA account data" },
  solana_verify_tx:  { handler: verifyTx,      description: "Confirm transaction" },
  solana_balance:    { handler: balance,    description: "Check SOL/SPL balance" },
  solana_history:    { handler: history,    description: "Deploy history log" },
};

// MCP JSON-RPC Handler
async function mcpHandler(req: any, res: any) {
  const { jsonrpc, method, params, id } = req.body ?? {};
  const send = (r: any) => res.json({ jsonrpc: "2.0", result: r, id });
  const fail = (c: number, m: string) => res.json({ jsonrpc: "2.0", error: { code: c, message: m }, id });
  if (method === "initialize") return send({ protocolVersion: "2024-11-05", serverInfo: { name: "solana-mcp", version: "1.0" }, capabilities: { tools: {} } });
  if (method === "tools/list") { const list = Object.entries(tools).map(([n, t]) => ({ name: n, description: (t as any).description, inputSchema: { type: "object", properties: {} } })); return send({ tools: list }); }
  if (method === "tools/call") { const tool = tools[params?.name]; if (!tool) return fail(-32602, "Unknown tool: " + params?.name); try { const result = await tool.handler(params?.arguments ?? {}); return send({ content: [{ type: "text", text: JSON.stringify(result) }] }); } catch (e: any) { return fail(-32000, e.message); } }
  if (method === "notifications/initialized") return res.json({ jsonrpc: "2.0", id });
  return fail(-32601, "Unknown method: " + method);
}
app.post("/", mcpHandler);
app.post("/mcp", mcpHandler);

app.get("/tools", (_req, res) => { const list = Object.entries(tools).map(([n, t]) => ({ name: n, description: (t as any).description, inputSchema: { type: "object", properties: {} } })); res.json({ tools: list }); });
app.post("/tools/:name", async (req, res) => { const tool = tools[req.params.name]; if (!tool) { res.status(404).json({ error: "Not found" }); return; } try { const r = await tool.handler(req.body ?? {}); res.json({ ok: true, tool: req.params.name, ...r }); } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); } });
app.get("/health", (_req, res) => { const urls = cfg.rpcUrls ?? [cfg.rpcUrl]; res.json({ status: "ok", timestamp: new Date().toISOString(), tools: Object.keys(tools).length, rpcUrl: getActiveRpcCount() + " of " + urls.length + " alive", keypairs: Object.keys(cfg.keypairs).length, projects: Object.keys(cfg.projects).length }); });

app.listen(cfg.port, cfg.host, () => { console.log(`solana-mcp on http://${cfg.host}:${cfg.port}`); });
