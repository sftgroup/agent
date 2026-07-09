import { existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import {
  loadConfig,
  readHistory,
  appendHistory,
  HistoryEntry,
} from "../config.js";

export interface CleanInput {
  olderThanHours?: number; // delete builds older than N hours (default: 1)
  buildId?: string; // delete specific build
  type?: "npm" | "docker" | "mobile";
}

export interface CleanResult {
  cleaned: number;
  freedBytes: number;
  entries: string[];
}

export async function buildClean(input: CleanInput): Promise<CleanResult> {
  const cfg = loadConfig();
  const entries: string[] = [];
  let freedBytes = 0;

  // Delete specific build
  if (input.buildId) {
    const all = readHistory(500);
    const found = all.find((e) => e.id === input.buildId);
    if (!found) return { cleaned: 0, freedBytes: 0, entries: [] };

    for (const prefix of ["npm-", "docker-", "mobile-"]) {
      const dir = join(cfg.buildDir, `${prefix}${input.buildId}`);
      if (existsSync(dir)) {
        try {
          const size = parseInt(
            require("child_process")
              .execSync(`du -sb "${dir}" | cut -f1`)
              .toString()
              .trim(),
          );
          rmSync(dir, { recursive: true, force: true });
          entries.push(dir);
          freedBytes += size;
        } catch {
          /* ignore */
        }
      }
    }
    return { cleaned: entries.length, freedBytes, entries };
  }

  // Clean by age
  const olderThan = input.olderThanHours ?? 1;
  const cutoff = Date.now() - olderThan * 3600 * 1000;
  const history = readHistory(500).filter((e) => {
    if (input.type && e.type !== input.type) return false;
    const ts = new Date(e.timestamp).getTime();
    return ts < cutoff && (e.status === "ok" || e.status === "fail");
  });

  for (const entry of history) {
    const prefix =
      entry.type === "npm"
        ? "npm-"
        : entry.type === "docker"
          ? "docker-"
          : "mobile-";
    const dir = join(cfg.buildDir, `${prefix}${entry.id}`);
    if (existsSync(dir)) {
      try {
        const size = parseInt(
          execSync(`du -sb "${dir}" | cut -f1`).toString().trim(),
        );
        rmSync(dir, { recursive: true, force: true });
        entries.push(dir);
        freedBytes += size;
      } catch {
        /* ignore */
      }
    }
  }

  // Log cleanup
  if (entries.length > 0) {
    const entry: HistoryEntry = {
      id: "cleanup-" + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      type: "npm",
      repo: "system",
      status: "ok",
      artifact: "",
      sizeBytes: freedBytes,
      durationMs: 0,
    };
    appendHistory(entry);
  }

  return { cleaned: entries.length, freedBytes, entries };
}

// Status of workspace disk usage
export interface DiskStatusResult {
  buildDir: string;
  totalSizeBytes: number;
  buildCount: number;
  oldestBuild?: string;
  newestBuild?: string;
}

export function buildDiskStatus(): DiskStatusResult {
  const cfg = loadConfig();
  if (!existsSync(cfg.buildDir))
    return { buildDir: cfg.buildDir, totalSizeBytes: 0, buildCount: 0 };

  let totalSize = 0;
  try {
    totalSize = parseInt(
      execSync(`du -sb "${cfg.buildDir}" | cut -f1`).toString().trim(),
    );
  } catch {
    /* ignore */
  }

  const dirs = readdirSync(cfg.buildDir);
  const history = readHistory(100);
  const oldestE = history[history.length - 1];
  const newestE = history[0];

  return {
    buildDir: cfg.buildDir,
    totalSizeBytes: totalSize,
    buildCount: dirs.length,
    oldestBuild: oldestE?.timestamp,
    newestBuild: newestE?.timestamp,
  };
}
