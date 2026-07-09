import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { homedir } from "os";

// ─── Config ────────────────────────────────────────────

export interface KeypairEntry {
  path: string;
}

export interface Config {
  port: number;
  host: string;
  rpcUrl: string;
  rpcUrls?: string[];
  keypairs: Record<string, string>;
  projects: Record<string, string>;
  historyPath?: string;
}

let _cfg: Config | null = null;
export function loadConfig(): Config {
  if (_cfg) return _cfg;
  const paths = [
    join(homedir(), ".solana-mcp", "config.json"),
    join(process.cwd(), "config.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      _cfg = JSON.parse(readFileSync(p, "utf-8")) as Config;
      _cfg.historyPath ??= join(homedir(), ".solana-mcp", "history.jsonl");
      _cfg.rpcUrls ??= [_cfg.rpcUrl];
      return _cfg as Config;
    }
  }
  // Defaults
  _cfg = {
    port: 3080,
    host: "127.0.0.1",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    keypairs: { default: join(homedir(), ".config", "solana", "id.json") },
    projects: {},
    historyPath: join(homedir(), ".solana-mcp", "history.jsonl"),
  };
  return _cfg;
}

// ─── History ────────────────────────────────────────────

export interface HistoryEntry {
  timestamp: string;
  tool: string;
  programId?: string;
  signature?: string;
  status: "ok" | "fail";
  details: string;
}

export function appendHistory(entry: HistoryEntry): void {
  const cfg = loadConfig();
  const dir = resolve(cfg.historyPath!, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(cfg.historyPath!, JSON.stringify(entry) + "\n", { flag: "a" });
}

export function readHistory(limit = 50, programId?: string): HistoryEntry[] {
  const cfg = loadConfig();
  if (!existsSync(cfg.historyPath!)) return [];
  const lines = readFileSync(cfg.historyPath!, "utf-8").trim().split("\n").filter(Boolean);
  let entries = lines.map(l => JSON.parse(l)) as HistoryEntry[];
  if (programId) entries = entries.filter(e => e.programId === programId);
  return entries.slice(-limit).reverse();
}


// ─── RPC Rotation ───────────────────────────────────────

let _rpcIndex = 0;
let _rpcFails: Record<string, number> = {};

export function getRpcUrl(): string {
  const cfg = loadConfig();
  const urls = cfg.rpcUrls ?? [cfg.rpcUrl];
  // Try each URL, skip ones with recent failures
  for (let i = 0; i < urls.length; i++) {
    const idx = (_rpcIndex + i) % urls.length;
    const url = urls[idx];
    const fails = _rpcFails[url] ?? 0;
    if (fails < 3) {
      _rpcIndex = (idx + 1) % urls.length;
      return url;
    }
  }
  // All failed — reset and try first
  _rpcFails = {};
  _rpcIndex = 0;
  return urls[0];
}

export function markRpcFail(url: string): void {
  _rpcFails[url] = (_rpcFails[url] ?? 0) + 1;
}

export function getActiveRpcCount(): number {
  const cfg = loadConfig();
  const urls = cfg.rpcUrls ?? [cfg.rpcUrl];
  return urls.filter(u => (_rpcFails[u] ?? 0) < 3).length;
}

// ─── Helpers ────────────────────────────────────────────

export function resolveKeypair(name: string): Uint8Array {
  const cfg = loadConfig();
  const kpPath = cfg.keypairs[name];
  if (!kpPath) throw new Error(`Unknown keypair: ${name}. Available: ${Object.keys(cfg.keypairs).join(", ")}`);
  const raw = readFileSync(kpPath, "utf-8");
  try {
    const arr = JSON.parse(raw);
    return Uint8Array.from(arr);
  } catch {
    return Uint8Array.from(JSON.parse(readFileSync(kpPath, "utf-8")));
  }
}

export function resolveProject(name: string): string {
  const cfg = loadConfig();
  const dir = cfg.projects[name];
  if (!dir) throw new Error(`Unknown project: ${name}. Available: ${Object.keys(cfg.projects).join(", ")}`);
  return dir;
}
