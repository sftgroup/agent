import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";

export interface Config {
  port: number;
  host: string;
  buildDir: string; // temp build workspace
  maxBuildTimeSec: number; // timeout
  historyPath: string;
  registries: {
    // docker registries
    dockerhub?: string;
    [key: string]: string | undefined;
  };
}

let _cfg: Config | null = null;
export function loadConfig(): Config {
  if (_cfg) return _cfg;
  const paths = [
    join(homedir(), ".build-mcp", "config.json"),
    join(process.cwd(), "config.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      _cfg = JSON.parse(readFileSync(p, "utf-8")) as Config;
      _cfg.historyPath ??= join(homedir(), ".build-mcp", "history.jsonl");
      _cfg.buildDir ??= "/tmp/build-mcp";
      _cfg.maxBuildTimeSec ??= 600;
      return _cfg;
    }
  }
  // defaults
  _cfg = {
    port: 3081,
    host: "127.0.0.1",
    buildDir: "/tmp/build-mcp",
    maxBuildTimeSec: 600,
    historyPath: join(homedir(), ".build-mcp", "history.jsonl"),
    registries: {},
  };
  return _cfg;
}

// ─── History ───────────────────────────────────────

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: "npm" | "docker" | "mobile";
  repo?: string;
  status: "ok" | "fail" | "running";
  artifact?: string;
  sizeBytes?: number;
  durationMs: number;
  error?: string;
}

export function appendHistory(entry: HistoryEntry): void {
  const cfg = loadConfig();
  const dir = join(cfg.historyPath, "..");
  mkdirSync(dir, { recursive: true });
  appendFileSync(cfg.historyPath, JSON.stringify(entry) + "\n");
}

export function readHistory(limit = 50): HistoryEntry[] {
  const cfg = loadConfig();
  if (!existsSync(cfg.historyPath)) return [];
  const lines = readFileSync(cfg.historyPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);
  return lines
    .map((l) => JSON.parse(l))
    .slice(-limit)
    .reverse();
}
