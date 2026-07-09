import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { loadConfig, appendHistory, HistoryEntry } from "../config.js";

export interface BuildDockerInput {
  repoUrl: string;
  branch?: string;
  dockerfile?: string; // relative path, default: "Dockerfile"
  imageName: string; // "myregistry.com/name:tag"
  buildArgs?: Record<string, string>;
  push?: boolean; // default: true
  registry?: string; // key from config.registries
  platform?: string; // default: "linux/amd64"
}

export interface BuildDockerResult {
  id: string;
  status: "ok" | "fail";
  imageName: string;
  imageId?: string;
  pushed: boolean;
  log: string;
  durationMs: number;
}

export async function buildDocker(
  input: BuildDockerInput,
): Promise<BuildDockerResult> {
  const cfg = loadConfig();
  const buildId = randomUUID().substring(0, 8);
  const workDir = join(cfg.buildDir, `docker-${buildId}`);
  const start = Date.now();

  mkdirSync(workDir, { recursive: true });

  const branch = input.branch ?? "main";

  const entry: HistoryEntry = {
    id: buildId,
    timestamp: new Date().toISOString(),
    type: "docker",
    repo: input.repoUrl,
    status: "running",
    durationMs: 0,
  };
  appendHistory(entry);

  let log = "";

  const run = (cmd: string, timeoutSec = 600): string => {
    try {
      const out = execSync(cmd, {
        cwd: workDir,
        timeout: timeoutSec * 1000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      log += out;
      return out;
    } catch (e: any) {
      const err =
        e.stderr?.toString() ?? e.stdout?.toString() ?? e.message ?? String(e);
      log += err;
      throw new Error(err);
    }
  };

  try {
    // Clone
    run(`git clone -b "${branch}" --single-branch "${input.repoUrl}" .`, 120);

    const dockerfile = join(workDir, input.dockerfile ?? "Dockerfile");
    if (!existsSync(dockerfile))
      throw new Error(`Dockerfile not found: ${dockerfile}`);

    // Build args
    const args = Object.entries(input.buildArgs ?? {})
      .map(([k, v]) => `--build-arg ${k}=${v}`)
      .join(" ");
    const platform = input.platform ? `--platform ${input.platform}` : "";

    // Build
    run(
      `docker build ${platform} ${args} -t "${input.imageName}" -f "${dockerfile}" "${workDir}"`,
      900,
    );

    // Extract image ID
    let imageId: string | undefined;
    try {
      imageId = execSync(
        `docker inspect --format='{{.Id}}' "${input.imageName}"`,
      )
        .toString()
        .trim();
    } catch {
      /* ignore */
    }

    let pushed = false;
    if (input.push !== false) {
      // Login if registry configured
      if (input.registry && cfg.registries[input.registry]) {
        const regUrl = cfg.registries[input.registry]!;
        // Docker Hub uses docker.io, otherwise custom
        if (regUrl !== "docker.io") {
          const regEnv = `REGISTRY_${input.registry.toUpperCase()}_TOKEN`;
          const token = process.env[regEnv];
          if (token) {
            run(
              `echo "${token}" | docker login "${regUrl}" --username ignored --password-stdin`,
              30,
            );
          }
        }
      }
      run(`docker push "${input.imageName}"`, 600);
      pushed = true;
    }

    const durationMs = Date.now() - start;

    entry.status = "ok";
    entry.artifact = input.imageName;
    entry.durationMs = durationMs;

    return {
      id: buildId,
      status: "ok",
      imageName: input.imageName,
      imageId,
      pushed,
      log: log.split("\n").slice(-30).join("\n"),
      durationMs,
    };
  } catch (e: any) {
    const durationMs = Date.now() - start;
    entry.status = "fail";
    entry.error = e.message?.substring(0, 500) ?? String(e);
    entry.durationMs = durationMs;
    return {
      id: buildId,
      status: "fail",
      imageName: input.imageName,
      pushed: false,
      log: log.split("\n").slice(-30).join("\n"),
      durationMs,
    };
  } finally {
    appendHistory(entry);
  }
}
