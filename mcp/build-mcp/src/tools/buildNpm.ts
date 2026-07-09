import { execSync, exec } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { loadConfig, appendHistory, HistoryEntry } from "../config.js";

export interface BuildNpmInput {
  repoUrl: string; // git clone URL
  branch?: string; // default: "main"
  installCmd?: string; // default: "pnpm install --frozen-lockfile"
  buildCmd?: string; // default: "pnpm build"
  buildDir?: string; // subdirectory for monorepo (default: repo root)
  nodeVersion?: string; // default: "22"
  env?: Record<string, string>; // extra env vars
}

export interface BuildResult {
  id: string;
  status: "ok" | "fail";
  artifactDir: string; // built dist/ dir
  log: string; // tail of build output
  durationMs: number;
  sizeBytes: number;
}

export async function buildNpm(input: BuildNpmInput): Promise<BuildResult> {
  const cfg = loadConfig();
  const buildId = randomUUID().substring(0, 8);
  const workDir = join(cfg.buildDir, `npm-${buildId}`);
  const start = Date.now();

  mkdirSync(workDir, { recursive: true });

  const branch = input.branch ?? "main";
  const installCmd = input.installCmd ?? "pnpm install --frozen-lockfile";
  const buildCmd = input.buildCmd ?? "pnpm build";

  // Start history
  const entry: HistoryEntry = {
    id: buildId,
    timestamp: new Date().toISOString(),
    type: "npm",
    repo: input.repoUrl,
    status: "running",
    durationMs: 0,
  };
  appendHistory(entry);

  let log = "";

  const run = (cmd: string, timeoutSec = 300): string => {
    try {
      const out = execSync(cmd, {
        cwd: workDir,
        timeout: timeoutSec * 1000,
        env: { ...process.env, ...input.env },
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      log += out;
      return out;
    } catch (e: any) {
      const stderr =
        e.stderr?.toString() ?? e.stdout?.toString() ?? e.message ?? String(e);
      log += stderr;
      throw new Error(stderr);
    }
  };

  try {
    // Clone
    const cloneUrl = input.repoUrl.replace(
      "https://",
      `https://${process.env.GIT_TOKEN ?? ""}@`,
    );
    run(`git clone -b "${branch}" --single-branch "${cloneUrl}" .`, 120);

    // Monorepo subdir
    const effectiveDir = input.buildDir
      ? join(workDir, input.buildDir)
      : workDir;

    // Setup Node
    const nodeBin = input.nodeVersion
      ? join(
          process.env.HOME ?? "/home/ubuntu",
          ".nvm/versions/node",
          `v${input.nodeVersion}.x`,
          "bin",
        )
      : "/usr/local/bin";
    const pathEnv = `${nodeBin}:${process.env.PATH}`;

    // Install
    run(`${installCmd}`, 300);
    // Build
    const buildOut = execSync(buildCmd, {
      cwd: effectiveDir,
      timeout: cfg.maxBuildTimeSec * 1000,
      env: { ...process.env, PATH: pathEnv, ...input.env },
      maxBuffer: 10 * 1024 * 1024,
    }).toString();
    log += buildOut;

    // Find artifact
    const distDir = join(effectiveDir, "dist");
    if (!existsSync(distDir)) {
      throw new Error(`Build completed but no dist/ found in ${effectiveDir}`);
    }

    // Calculate size
    const sizeBytes = parseInt(
      execSync(`du -sb "${distDir}" | cut -f1`, { timeout: 10000 })
        .toString()
        .trim(),
    );

    const durationMs = Date.now() - start;

    entry.status = "ok";
    entry.artifact = distDir;
    entry.sizeBytes = sizeBytes;
    entry.durationMs = durationMs;

    return {
      id: buildId,
      status: "ok",
      artifactDir: distDir,
      log: log.split("\n").slice(-40).join("\n"),
      durationMs,
      sizeBytes,
    };
  } catch (e: any) {
    const durationMs = Date.now() - start;
    entry.status = "fail";
    entry.error = e.message?.substring(0, 500) ?? String(e);
    entry.durationMs = durationMs;
    appendHistory(entry);
    throw new Error(
      `Build ${buildId} failed (${durationMs}ms): ${e.message?.substring(0, 500)}`,
    );
  } finally {
    appendHistory(entry);
  }
}
