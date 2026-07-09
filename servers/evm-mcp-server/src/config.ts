// Chain configuration — single source of truth
export interface ChainConfig {
  id: number;
  name: string;
  rpc: string;
  explorer: string;
  explorerApi: string;
  explorerApiKey: string;
  currency: string;
  isTestnet: boolean;
}

const CHAINS: Record<string, ChainConfig> = {
  eth: {
    id: 1, name: "Ethereum",
    rpc: process.env.ETH_RPC || "",
    explorer: "https://etherscan.io",
    explorerApi: "https://api.etherscan.io/api",
    explorerApiKey: process.env.ETHERSCAN_API_KEY || "",
    currency: "ETH",
    isTestnet: false,
  },
  bsc: {
    id: 56, name: "BSC",
    rpc: process.env.BSC_RPC || "",
    explorer: "https://bscscan.com",
    explorerApi: "https://api.bscscan.com/api",
    explorerApiKey: process.env.BSCSCAN_API_KEY || "",
    currency: "BNB",
    isTestnet: false,
  },
  base: {
    id: 8453, name: "Base",
    rpc: process.env.BASE_RPC || "",
    explorer: "https://basescan.org",
    explorerApi: "https://api.basescan.org/api",
    explorerApiKey: process.env.BASESCAN_API_KEY || "",
    currency: "ETH",
    isTestnet: false,
  },
  polygon: {
    id: 137, name: "Polygon",
    rpc: process.env.POLYGON_RPC || "",
    explorer: "https://polygonscan.com",
    explorerApi: "https://api.polygonscan.com/api",
    explorerApiKey: process.env.POLYGONSCAN_API_KEY || "",
    currency: "POL",
    isTestnet: false,
  },
  arb: {
    id: 42161, name: "Arbitrum",
    rpc: process.env.ARB_RPC || "",
    explorer: "https://arbiscan.io",
    explorerApi: "https://api.arbiscan.io/api",
    explorerApiKey: process.env.ARBISCAN_API_KEY || "",
    currency: "ETH",
    isTestnet: false,
  },
  sepolia: {
    id: 11155111, name: "Sepolia",
    rpc: process.env.SEPOLIA_RPC || "https://sepolia.infura.io/v3/KEY",
    explorer: "https://sepolia.etherscan.io",
    explorerApi: "https://api-sepolia.etherscan.io/api",
    explorerApiKey: process.env.ETHERSCAN_API_KEY || "",
    currency: "ETH",
    isTestnet: true,
  },
};

export function getChain(chain: string): ChainConfig {
  const c = CHAINS[chain];
  if (!c) throw new Error(`Unknown chain: ${chain}. Known: ${Object.keys(CHAINS).join(", ")}`);
  if (!c.rpc) throw new Error(`RPC not configured for ${chain}`);
  return c;
}

export function getChainOrNull(chain: string): ChainConfig | null {
  return CHAINS[chain] ?? null;
}

export function listChains(): ChainConfig[] {
  return Object.values(CHAINS).filter(c => c.rpc);
}

// Token aliases
const TOKEN_ALIASES: Record<string, Record<string, string>> = {
  eth: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  bsc: {
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    busd: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  },
  base: {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  polygon: {
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  arb: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
};

export function resolveToken(chain: string, token: string): string {
  // If it looks like an address, use directly
  if (/^0x[a-fA-F0-9]{40}$/.test(token)) return token;
  const lower = token.toLowerCase();
  const aliases = TOKEN_ALIASES[chain];
  if (!aliases?.[lower]) throw new Error(`Unknown token "${token}" on ${chain}. Use address or alias: ${Object.keys(aliases || {}).join(", ")}`);
  return aliases[lower];
}

// Gas presets
const GAS_PRESETS: Record<string, Record<string, { maxFee: number; priorityFee: number }>> = {
  eth: {
    slow:    { maxFee: 30,  priorityFee: 1 },
    normal:  { maxFee: 50,  priorityFee: 2 },
    fast:    { maxFee: 100, priorityFee: 3 },
  },
  bsc: {
    slow:    { maxFee: 1,  priorityFee: 1 },
    normal:  { maxFee: 3,  priorityFee: 1 },
    fast:    { maxFee: 5,  priorityFee: 2 },
  },
  base: {
    slow:    { maxFee: 0.001, priorityFee: 0.0001 },
    normal:  { maxFee: 0.01,  priorityFee: 0.001 },
    fast:    { maxFee: 0.05,  priorityFee: 0.005 },
  },
  polygon: {
    slow:    { maxFee: 50,  priorityFee: 30 },
    normal:  { maxFee: 100, priorityFee: 40 },
    fast:    { maxFee: 200, priorityFee: 50 },
  },
  arb: {
    slow:    { maxFee: 0.01, priorityFee: 0.001 },
    normal:  { maxFee: 0.05, priorityFee: 0.005 },
    fast:    { maxFee: 0.1,  priorityFee: 0.01 },
  },
};

export function getGasPreset(chain: string, priority: "slow" | "normal" | "fast" = "normal") {
  const presets = GAS_PRESETS[chain] || GAS_PRESETS.eth;
  return presets[priority] || presets.normal;
}
