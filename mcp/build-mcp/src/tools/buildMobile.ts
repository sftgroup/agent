import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { loadConfig, appendHistory, HistoryEntry } from "../config.js";

export type MobilePlatform = "ios" | "android" | "both";

export interface BuildMobileInput {
  repoUrl: string;
  branch?: string;
  platform: MobilePlatform;
  framework: "react-native" | "flutter" | "expo";
  buildType?: "debug" | "release";   // default: "release"
  scheme?: string;                    // iOS scheme
  buildDir?: string;                  // monorepo subdir
  env?: Record<string, string>;
}

export interface BuildMobileResult {
  id: string;
  status: "ok" | "fail";
  platform: MobilePlatform;
  artifacts: { platform: string; path: string; sizeBytes: number }[];
  log: string;
  durationMs: number;
}

export async function buildMobile(input: BuildMobileInput): Promise<BuildMobileResult> {
  const cfg = loadConfig();
  const buildId = randomUUID().substring(0, 8);
  const workDir = join(cfg.buildDir, `mobile-${buildId}`);
  const start = Date.now();

  mkdirSync(workDir, { recursive: true });

  const branch = input.branch ?? "main";
  const buildType = input.buildType ?? "release";

  const entry: HistoryEntry = {
    id: buildId,
    timestamp: new Date().toISOString(),
    type: "mobile",
    repo: input.repoUrl,
    artifact: input.platform,
    status: "running",
    durationMs: 0,
  };
  appendHistory(entry);

  let log = "";
  const run = (cmd: string, cwd: string = workDir, timeoutSec = 900): string => {
    try {
      const out = execSync(cmd, { cwd, timeout: timeoutSec * 1000, env: { ...process.env, ...input.env }, maxBuffer: 10 * 1024 * 1024 }).toString();
      log += out;
      return out;
    } catch (e: any) {
      const err = e.stderr?.toString() ?? e.stdout?.toString() ?? e.message ?? String(e);
      log += err;
      throw new Error(err);
    }
  };

  try {
    // Clone
    run(`git clone -b "${branch}" --single-branch "${input.repoUrl}" .`, workDir, 120);
    const effectiveDir = input.buildDir ? join(workDir, input.buildDir) : workDir;

    // Install deps
    run("pnpm install --frozen-lockfile || yarn install --frozen-lockfile || npm install", effectiveDir, 300);

    const artifacts: { platform: string; path: string; sizeBytes: number }[] = [];

    if (input.framework === "react-native") {
      if (input.platform === "ios" || input.platform === "both") {
        // iOS: use xcodebuild or fastlane
        try {
          if (existsSync(join(effectiveDir, "ios", "fastlane"))) {
            const scheme = input.scheme ?? "";
            run(`cd ios && bundle exec fastlane ios ${scheme ? `build_${scheme}` : "build"}`, effectiveDir, 900);
          } else {
            run(`cd ios && xcodebuild -workspace *.xcworkspace -scheme "${input.scheme ?? 'App'}" -configuration Release -archivePath build/App.xcarchive archive`, effectiveDir, 900);
          }
          const ipaDir = join(effectiveDir, "ios", "build");
          if (existsSync(ipaDir)) {
            const size = parseInt(execSync(`du -sb "${ipaDir}" | cut -f1`).toString().trim());
            artifacts.push({ platform: "ios", path: ipaDir, sizeBytes: size });
          }
        } catch (e: any) {
          run(`echo "iOS build skipped: ${e.message}"`, workDir, 5);
        }
      }

      if (input.platform === "android" || input.platform === "both") {
        try {
          run(`cd android && ./gradlew assemble${buildType === "release" ? "Release" : "Debug"}`, effectiveDir, 900);
          const apkDir = join(effectiveDir, "android", "app", "build", "outputs", "apk", buildType);
          if (existsSync(apkDir)) {
            const size = parseInt(execSync(`du -sb "${apkDir}" | cut -f1`).toString().trim());
            artifacts.push({ platform: "android", path: apkDir, sizeBytes: size });
          }
        } catch (e: any) {
          run(`echo "Android build skipped: ${e.message}"`, workDir, 5);
        }
      }
    } else if (input.framework === "flutter") {
      if (input.platform === "ios" || input.platform === "both") {
        run(`flutter build ios --${buildType} --no-codesign`, effectiveDir, 900);
        const iosBuild = join(effectiveDir, "build", "ios");
        if (existsSync(iosBuild)) {
          const size = parseInt(execSync(`du -sb "${iosBuild}" | cut -f1`).toString().trim());
          artifacts.push({ platform: "ios", path: iosBuild, sizeBytes: size });
        }
      }
      if (input.platform === "android" || input.platform === "both") {
        run(`flutter build apk --${buildType}`, effectiveDir, 900);
        const apkDir = join(effectiveDir, "build", "app", "outputs", "flutter-apk");
        if (existsSync(apkDir)) {
          const size = parseInt(execSync(`du -sb "${apkDir}" | cut -f1`).toString().trim());
          artifacts.push({ platform: "android", path: apkDir, sizeBytes: size });
        }
      }
    } else if (input.framework === "expo") {
      // Expo uses EAS Build or local
      const easToken = input.env?.EXPO_TOKEN ?? process.env.EXPO_TOKEN;
      if (easToken) {
        const targets = input.platform === "both" ? "all" : input.platform;
        run(`npx eas build --platform ${targets} --profile ${buildType} --non-interactive`, effectiveDir, 900);
        // EAS returns URL, not local file
        const easDir = join(effectiveDir, "dist");
        if (existsSync(easDir)) {
          const size = parseInt(execSync(`du -sb "${easDir}" | cut -f1`).toString().trim());
          artifacts.push({ platform: input.platform, path: easDir, sizeBytes: size });
        }
      } else {
        run("npx expo export --platform web", effectiveDir, 300);
        const webDir = join(effectiveDir, "dist");
        if (existsSync(webDir)) {
          const size = parseInt(execSync(`du -sb "${webDir}" | cut -f1`).toString().trim());
          artifacts.push({ platform: "web", path: webDir, sizeBytes: size });
        }
      }
    }

    if (artifacts.length === 0) {
      throw new Error("No build artifacts found. Check framework/platform settings.");
    }

    const durationMs = Date.now() - start;

    entry.status = "ok";
    entry.artifact = artifacts.map(a => a.platform).join(", ");
    entry.sizeBytes = artifacts.reduce((s, a) => s + a.sizeBytes, 0);
    entry.durationMs = durationMs;

    return {
      id: buildId,
      status: "ok",
      platform: input.platform,
      artifacts,
      log: log.split("\n").slice(-40).join("\n"),
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
      platform: input.platform,
      artifacts: [],
      log: log.split("\n").slice(-40).join("\n"),
      durationMs,
    };
  } finally {
    appendHistory(entry);
  }
}
