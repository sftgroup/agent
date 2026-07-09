import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  {
    name: "evm_status",
    description: "Query chain status: block number, gas price, address balance/nonce/contracts",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", description: "Chain: eth|bsc|base|polygon|arb|sepolia" },
        address: { type: "string", description: "Optional. Get balance/nonce for address" },
      },
      required: ["chain"],
    },
  },
  {
    name: "evm_call",
    description: "Read-only contract call (eth_call)",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string" },
        abi: { type: "array", description: "Contract ABI (optional, auto-built from method)" },
        method: { type: "string", description: "Method signature, e.g. balanceOf(address)(uint256)" },
        args: { type: "array" },
      },
      required: ["chain", "address", "method"],
    },
  },
  {
    name: "evm_send",
    description: "Send transaction to contract (eth_sendTransaction) — writes to blockchain",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string" },
        method: { type: "string" },
        args: { type: "array" },
        value: { type: "string", description: "ETH value in ether units" },
        gas_limit: { type: "number" },
        max_fee_per_gas: { type: "string", description: "gwei" },
        max_priority_fee_per_gas: { type: "string", description: "gwei" },
      },
      required: ["chain", "address", "method"],
    },
  },
  {
    name: "evm_deploy",
    description: "Compile and deploy contract. Auto-verifies. Saves to registry.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        project_dir: { type: "string", description: "Absolute path to project root" },
        contract_name: { type: "string" },
        constructor_args: { type: "array" },
        gas_limit: { type: "number", default: 3000000 },
        verify: { type: "boolean", default: true },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["chain", "project_dir", "contract_name"],
    },
  },
  {
    name: "evm_verify",
    description: "Verify deployed contract on Etherscan/BscScan",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string" },
        contract_name: { type: "string" },
        constructor_args: { type: "array" },
        project_dir: { type: "string" },
      },
      required: ["chain", "address", "contract_name", "project_dir"],
    },
  },
  {
    name: "evm_logs",
    description: "Query event logs from blockchain",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string", description: "Single address or comma-separated" },
        topic0: { type: "string", description: "Event signature hash" },
        topic1: { type: "string", description: "Optional indexed parameter" },
        from_block: { type: "number" },
        to_block: { type: ["number", "string"], description: "Number or 'latest'" },
      },
      required: ["chain", "address", "topic0", "from_block"],
    },
  },
  {
    name: "evm_token",
    description: "ERC20 token operations: balance, transfer, approve, allowance",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["balance", "transfer", "approve", "allowance"] },
        chain: { type: "string" },
        token: { type: "string", description: "Address or alias: usdc, usdt, dai, busd" },
        owner: { type: "string" },
        spender: { type: "string" },
        recipient: { type: "string" },
        amount: { type: "string", description: "Human-readable amount" },
      },
      required: ["action", "chain", "token"],
    },
  },
  {
    name: "evm_gas_preset",
    description: "Get recommended gas settings for chain",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        priority: { type: "string", enum: ["slow", "normal", "fast"], default: "normal" },
      },
      required: ["chain"],
    },
  },
  {
    name: "evm_registry",
    description: "Query contract deployment registry",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        name: { type: "string" },
        tag: { type: "string" },
      },
    },
  },
];

const server = new Server(
  { name: "evm-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "evm_status":
        result = await evm_status(args as any);
        break;
      case "evm_call":
        result = await evm_call(args as any);
        break;
      case "evm_send":
        result = await evm_send(args as any);
        break;
      case "evm_deploy":
        result = await evm_deploy(args as any);
        break;
      case "evm_verify":
        result = await evm_verify(args as any);
        break;
      case "evm_logs":
        result = await evm_logs(args as any);
        break;
      case "evm_token":
        result = await evm_token(args as any);
        break;
      case "evm_gas_preset":
        result = await evm_gas_preset(args as any);
        break;
      case "evm_registry":
        result = { contracts: getDeployments(args as any) };
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: e.message }) }],
      isError: true,
    };
  }
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("EVM MCP Server v0.1.0 ready (stdio)");
