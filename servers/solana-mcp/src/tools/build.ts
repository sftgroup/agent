import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { appendHistory, resolveKeypair, resolveProject } from "../config.js";

export interface BuildInput {
  projectDir?: string;     // absolute path, or use project name
  projectName?: string;    // key from config.projects
  edition?: string;        // "2021" (default) or "2024"
  options?: string;        // extra cargo build-sbf flags
}

export interface BuildResult {
  soPath: string;
  sizeKB: number;
  warnings: string[];
  durationMs: number;
}

export async function build(input: BuildInput): Promise<BuildResult> {
  const dir = input.projectDir ?? resolveProject(input.projectName ?? "default");
  const absDir = resolve(dir);
  if (!existsSync(absDir)) throw new Error(`Project directory not found: ${absDir}`);

  const edition = input.edition ?? "2021";
  const options = input.options ?? "";

  // Edition check
  if (edition === "2024") {
    const sbfRustc = execSync(
      `find ~/.cache/solana -name rustc -path "*/bin/rustc" 2>/dev/null | head -1`,
      { shell: "/bin/bash" }
    ).toString().trim();

    if (sbfRustc) {
      const ver = execSync(`${sbfRustc} --version`).toString().trim();
      const match = /rustc (\d+\.\d+)/.exec(ver);
      if (match && parseFloat(match[1]) < 1.85) {
        throw new Error(
          `SBF rustc ${match[1]} does not support edition2024. ` +
          `Use edition="2021" or swap platform-tools to v1.54+.`
        );
      }
    }
  }

  const start = Date.now();

  // Clean + build
  execSync("rm -rf target/deploy/*.so target/sbf 2>/dev/null; true", { cwd: absDir });
  const cmd = `cargo build-sbf --sbf-out-dir target/deploy ${options}`;
  let output: string;
  try {
    output = execSync(cmd, { cwd: absDir, env: { ...process.env, PATH: process.env.PATH }, timeout: 120_000 })
      .toString();
  } catch (e: any) {
    const stderr = e.stderr?.toString() ?? e.stdout?.toString() ?? e.message;
    appendHistory({
      timestamp: new Date().toISOString(),
      tool: "build",
      status: "fail",
      details: stderr.substring(0, 500),
    });
    throw new Error(`Build failed: ${stderr.substring(0, 1000)}`);
  }

  // Find .so
  const soFiles = execSync("ls -t target/deploy/*.so 2>/dev/null || true", { cwd: absDir }).toString().trim().split("\n").filter(Boolean);
  if (soFiles.length === 0) {
    throw new Error("Build produced no .so file in target/deploy/");
  }
  const soPath = resolve(absDir, soFiles[0]);
  const sizeBytes = execSync(`stat -c%s "${soPath}"`).toString().trim();
  const sizeKB = Math.round(Number(sizeBytes) / 1024);

  // Extract warnings
  const warnPattern = /warning: .*/g;
  const warnings = [...output.matchAll(warnPattern)].map(m => m[0]);

  const durationMs = Date.now() - start;

  // Check .so size
  if (sizeKB > 200) {
    warnings.push(`SO file is ${sizeKB}KB (over 200KB limit). Add lto=true and codegen-units=1 to [profile.release].`);
  }

  appendHistory({
    timestamp: new Date().toISOString(),
    tool: "build",
    status: "ok",
    details: `${soPath} (${sizeKB}KB, ${durationMs}ms, ${warnings.length} warnings)`,
  });

  return { soPath, sizeKB, warnings, durationMs };
}
