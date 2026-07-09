// HTTP entry point — wraps MCP server with Express for streamable-http transport
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  evm_status, evm_call, evm_send, evm_deploy,
  evm_verify, evm_logs, evm_token, evm_gas_preset,
} from "./tools.js";
import { getDeployments } from "./store.js";

const TOOLS: Tool[] = [
  { name: "evm_status", description: "Query chain status: block, gas, balance, nonce, registered contracts", inputSchema: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" } }, required: ["chain"] } },
  { name: "evm_call", description: "Read-only contract call (eth_call)", inputSchema: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, abi: { type: "array" }, method: { type: "string" }, args: { type: "array" } }, required: ["chain", "address", "method"] } },
  { name: "evm_send", description: "Send transaction to contract. EIP-1559 gas. Tracks in queue.", inputSchema: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, method: { type: "string" }, args: { type: "array" }, value: { type: "string" }, gas_limit: { type: "number" }, max_fee_per_gas: { type: "string" }, max_priority_fee_per_gas: { type: "string" } }, required: ["chain", "address", "method"] } },
  { name: "evm_deploy", description: "Compile + deploy + auto-verify. Saves to registry. Forge + Hardhat.", inputSchema: { type: "object", properties: { chain: { type: "string" }, project_dir: { type: "string" }, contract_name: { type: "string" }, constructor_args: { type: "array" }, gas_limit: { type: "number", default: 3000000 }, verify: { type: "boolean", default: true }, tags: { type: "array", items: { type: "string" } } }, required: ["chain", "project_dir", "contract_name"] } },
  { name: "evm_verify", description: "Verify deployed contract on explorer", inputSchema: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, contract_name: { type: "string" }, constructor_args: { type: "array" }, project_dir: { type: "string" } }, required: ["chain", "address", "contract_name", "project_dir"] } },
  { name: "evm_logs", description: "Query event logs", inputSchema: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, topic0: { type: "string" }, topic1: { type: "string" }, from_block: { type: "number" }, to_block: { type: ["number", "string"] } }, required: ["chain", "address", "topic0", "from_block"] } },
  { name: "evm_token", description: "ERC20: balance, transfer, approve, allowance", inputSchema: { type: "object", properties: { action: { type: "string", enum: ["balance", "transfer", "approve", "allowance"] }, chain: { type: "string" }, token: { type: "string", description: "Address or alias (usdc, usdt, dai, busd)" }, owner: { type: "string" }, spender: { type: "string" }, recipient: { type: "string" }, amount: { type: "string" } }, required: ["action", "chain", "token"] } },
  { name: "evm_gas_preset", description: "Recommended gas per chain and priority", inputSchema: { type: "object", properties: { chain: { type: "string" }, priority: { type: "string", enum: ["slow", "normal", "fast"], default: "normal" } }, required: ["chain"] } },
  { name: "evm_registry", description: "Query deployment history with optional filters", inputSchema: { type: "object", properties: { chain: { type: "string" }, name: { type: "string" }, tag: { type: "string" } } } },
];

const ROUTE_MAP: Record<string, (args: any) => Promise<any>> = {
  evm_status: evm_status,
  evm_call: evm_call,
  evm_send: evm_send,
  evm_deploy: evm_deploy,
  evm_verify: evm_verify,
  evm_logs: evm_logs,
  evm_token: evm_token,
  evm_gas_preset: evm_gas_preset,
  evm_registry: (a: any) => Promise.resolve({ contracts: getDeployments(a) }),
};

// ─── Express HTTP server (stateless, no persistent transport) ─────
const app = express();
app.use(cors());
app.use(express.json());

// Auth
const API_TOKEN = process.env.API_TOKEN;
app.use((req, res, next) => {
  if (API_TOKEN && req.path !== "/health") {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${API_TOKEN}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// MCP JSON-RPC endpoint
app.post("/mcp", async (req, res) => {
  const { method, params, id } = req.body;

  if (method === "tools/list") {
    return res.json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const fn = ROUTE_MAP[toolName];
    if (!fn) {
      return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } });
    }
    console.log(`[${new Date().toISOString()}] ${toolName} ${JSON.stringify(params?.arguments).slice(0, 200)}`);
    try {
      const result = await fn(params?.arguments ?? {});
      return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
    } catch (e: any) {
      console.error(`  ❌ ${toolName}:`, e.message);
      return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true } });
    }
  }

  return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
});

// Listen
const PORT = parseInt(process.env.PORT || "8199", 10);
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`🔗 EVM MCP Server v0.2.0 — http://${HOST}:${PORT}`);
  console.log(`   Health: http://${HOST}:${PORT}/health`);
  console.log(`   MCP:    POST http://${HOST}:${PORT}/mcp`);
  console.log(`   Auth:   ${API_TOKEN ? "Bearer token" : "OFF (set API_TOKEN to enable)"}`);
});
