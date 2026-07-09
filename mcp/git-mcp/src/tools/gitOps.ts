import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { loadConfig } from "../config.js";
import {
  registerRepo, listRepos, getRepo, updateRepo, deleteRepo,
  createTag, listTags, getLatestTag,
  logAudit, listAudit,
  RepoRow, VersionRow, AuditRow
} from "../db.js";

const cfg = loadConfig();

// ─── Git helpers ──────────────────────────────────────

function gitTokenUrl(url: string): string {
  const token = process.env.GIT_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (!token) return url;
  return url.replace("https://", `https://${token}@`);
}

function git(cwd: string, cmd: string, timeoutSec = 60): string {
  return execSync(`git ${cmd}`, { cwd, timeout: timeoutSec * 1000, maxBuffer: 5 * 1024 * 1024 }).toString().trim();
}

function gitOptional(cwd: string, cmd: string, timeoutSec = 30): string {
  try { return git(cwd, cmd, timeoutSec); } catch { return ""; }
}

// ─── Repo Management ──────────────────────────────────

export async function apiRegisterRepo(input: {
  name: string; github_url: string; default_branch?: string;
  description?: string; tags?: string; guard_config?: string;
}) {
  if (getRepo(input.name)) throw new Error(`Repo "${input.name}" already registered`);
  const localPath = join(cfg.repoBasePath, input.name);
  const repo = registerRepo({ ...input, local_path: localPath });
  logAudit(input.name, "repo_register", { triggeredBy: "api", status: "ok" });
  return { repo, message: `Registered ${input.name}. Use git_clone to clone.` };
}

export async function apiListRepos(input: { search?: string }) {
  const repos = listRepos(input.search);
  return { repos, total: repos.length };
}

export async function apiGetRepo(input: { name: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found. Use repo_list to see available repos.`);
  const latest = getLatestTag(input.name);
  const tags = listTags(input.name);
  return { repo, latestTag: latest?.tag ?? null, tags };
}

export async function apiCreateGithubRepo(input: { name: string; description?: string; private?: boolean }) {
  const org = cfg.githubOrg;
  const token = process.env.GIT_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GIT_TOKEN env var not set");

  // Create repo via GitHub API
  const body = JSON.stringify({
    name: input.name,
    description: input.description ?? "",
    private: input.private ?? false,
    auto_init: true,
  });
  const url = `https://api.github.com/orgs/${org}/repos`;
  const result = execSync(
    `curl -s -X POST "${url}" -H "Authorization: token ${token}" -H "Content-Type: application/json" -d '${body}'`,
    { timeout: 30000 }
  ).toString();
  const ghRepo = JSON.parse(result);
  if (ghRepo.message && ghRepo.message !== "Created") {
    throw new Error(`GitHub API error: ${ghRepo.message}`);
  }

  const githubUrl = ghRepo.ssh_url ?? `https://github.com/${org}/${input.name}.git`;
  const localPath = join(cfg.repoBasePath, input.name);
  const repo = registerRepo({
    name: input.name,
    github_url: githubUrl,
    local_path: localPath,
    default_branch: ghRepo.default_branch ?? "master",
    description: input.description,
  });
  logAudit(input.name, "github_create", { triggeredBy: "api", status: "ok" });
  return { repo, github_url: ghRepo.html_url };
}

// ─── Git Operations ───────────────────────────────────

export async function apiClone(input: { name: string; branch?: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  const localPath = repo.local_path;
  const branch = input.branch ?? repo.default_branch;

  if (existsSync(join(localPath, ".git"))) {
    // Already cloned — pull instead
    git(localPath, `checkout ${branch}`);
    const out = git(localPath, "pull --rebase");
    logAudit(input.name, "clone", { branch, commitSha: gitOptional(localPath, "rev-parse HEAD"), status: "ok", message: "already cloned, pulled" });
    return { alreadyCloned: true, path: localPath, branch, message: out };
  }

  mkdirSync(localPath, { recursive: true });
  const url = gitTokenUrl(repo.github_url);
  const out = git(localPath, `clone -b "${branch}" --single-branch "${url}" .`);
  logAudit(input.name, "clone", { branch, commitSha: gitOptional(localPath, "rev-parse HEAD"), status: "ok", message: out });
  return { path: localPath, branch, message: out };
}

export async function apiPull(input: { name: string; branch?: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  if (!existsSync(join(repo.local_path, ".git"))) throw new Error(`Not cloned. Run git_clone first.`);

  const branch = input.branch ?? repo.default_branch;

  // Check for uncommitted changes
  const status = git(repo.local_path, "status --porcelain");
  const dirty = status.split("\n").filter(Boolean);

  if (dirty.length > 0) {
    return {
      ok: false, dirty: true,
      files: dirty.map(l => l.substring(3)).slice(0, 20),
      message: `${dirty.length} uncommitted file(s). Commit or stash before pull.`
    };
  }

  git(repo.local_path, `checkout ${branch}`);
  const before = git(repo.local_path, "rev-parse HEAD");
  const out = git(repo.local_path, "pull --rebase");
  const after = git(repo.local_path, "rev-parse HEAD");

  logAudit(input.name, "pull", { branch, commitSha: after, message: out, status: "ok" });
  return { ok: true, branch, beforeSha: before, afterSha: after, message: out };
}

export async function apiPush(input: {
  name: string; message: string; branch?: string;
  files?: string[]; force?: boolean; skipChecks?: boolean;
}) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  const localPath = repo.local_path;
  const branch = input.branch ?? repo.default_branch;

  if (!existsSync(join(localPath, ".git"))) throw new Error(`Not cloned. Run git_clone first.`);

  // 1. Pull latest
  try { git(localPath, "pull --rebase"); } catch {
    return { ok: false, stage: "pull", error: "Failed to pull latest. Resolve merge conflicts first." };
  }

  // 2. Integrity check (unless skipped)
  let checkResult = null;
  if (!input.skipChecks) {
    checkResult = await apiCheck({ name: input.name, branch });
    if (!checkResult.passed && !input.force) {
      return {
        ok: false, stage: "integrity_check",
        error: "Integrity check failed. Fix errors or pass force=true to override.",
        checks: checkResult.checks,
      };
    }
  }

  // 3. Stage files
  git(localPath, "add .");
  if (input.files) {
    git(localPath, "reset HEAD"); // unstage all
    for (const f of input.files) git(localPath, `add "${f}"`);
  }

  // 4. Check if anything to commit
  const status = gitOptional(localPath, "status --porcelain");
  if (!status) return { ok: false, error: "No changes to commit." };

  // 5. Commit
  git(localPath, `commit -m "${input.message.replace(/"/g, '\\"')}"`);

  // 6. Push
  const commitSha = git(localPath, "rev-parse HEAD");
  let pushCmd = `push origin ${branch}`;
  if (input.force) pushCmd += " --force-with-lease";
  const pushOut = git(localPath, pushCmd);

  logAudit(input.name, "push", {
    branch, commitSha,
    message: input.message,
    checks: checkResult?.checks ?? {},
    status: "ok",
  });

  return {
    ok: true, commitSha, branch,
    checks: checkResult?.checks ?? null,
    message: pushOut,
  };
}

// ─── Status ────────────────────────────────────────────

export async function apiStatus(input: { name: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  if (!existsSync(join(repo.local_path, ".git"))) throw new Error(`Not cloned.`);

  const branch = git(repo.local_path, "branch --show-current");
  const status = git(repo.local_path, "status --porcelain");
  const commitSha = gitOptional(repo.local_path, "rev-parse HEAD");

  const staged = status.split("\n").filter(l => /^[MADRC]/.test(l));
  const unstaged = status.split("\n").filter(l => /^.[MDRC]/.test(l));
  const untracked = status.split("\n").filter(l => /^\?\?/.test(l));

  return {
    repo: input.name, branch, commitSha,
    dirty: status.length > 0,
    staged: staged.length, unstaged: unstaged.length, untracked: untracked.length,
    files: status.split("\n").filter(Boolean).map(l => l.substring(3)).slice(0, 50),
  };
}

// ─── Tags ──────────────────────────────────────────────

export async function apiCreateTag(input: { name: string; tag: string; description?: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  if (!existsSync(join(repo.local_path, ".git"))) throw new Error(`Not cloned.`);

  const commitSha = git(repo.local_path, "rev-parse HEAD");
  git(repo.local_path, `tag -a "${input.tag}" -m "${input.description ?? input.tag}"`);
  git(repo.local_path, `push origin "${input.tag}"`);

  createTag(input.name, input.tag, commitSha, input.description, "api");
  logAudit(input.name, "tag", { branch: input.tag, commitSha, message: `Created tag ${input.tag}`, status: "ok" });
  return { tag: input.tag, commitSha };
}

export async function apiListTags(input: { name: string }) {
  const tags = listTags(input.name);
  return { tags, total: tags.length };
}

// ─── Log ───────────────────────────────────────────────

export async function apiLog(input: { name: string; limit?: number }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  if (!existsSync(join(repo.local_path, ".git"))) throw new Error(`Not cloned.`);

  const n = input.limit ?? 20;
  const raw = git(repo.local_path, `log --oneline -${n}`);
  const entries = raw.split("\n").filter(Boolean).map(line => {
    const [sha, ...msg] = line.split(" ");
    return { sha, message: msg.join(" ") };
  });

  return { repo: input.name, entries, total: entries.length };
}

export async function apiLogAudit(input: { name?: string; limit?: number }) {
  const rows = listAudit(input.name, input.limit ?? 50);
  return { entries: rows, total: rows.length };
}

// ─── Checkout ──────────────────────────────────────────

export async function apiCheckout(input: { name: string; ref: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  if (!existsSync(join(repo.local_path, ".git"))) throw new Error(`Not cloned.`);

  // Check for dirty state
  const status = gitOptional(repo.local_path, "status --porcelain");
  if (status) return { ok: false, dirty: true, message: "Uncommitted changes. Commit or stash first." };

  const out = git(repo.local_path, `checkout "${input.ref}"`);
  const branch = git(repo.local_path, "branch --show-current");
  logAudit(input.name, "checkout", { branch, commitSha: gitOptional(repo.local_path, "rev-parse HEAD"), message: out });
  return { ok: true, ref: input.ref, branch };
}

// ─── Integrity Check ──────────────────────────────────

export async function apiCheck(input: { name: string; branch?: string }) {
  const repo = getRepo(input.name);
  if (!repo) throw new Error(`Repo "${input.name}" not found`);
  const localPath = repo.local_path;
  if (!existsSync(join(localPath, ".git"))) throw new Error(`Not cloned.`);

  const guardConfig = JSON.parse(repo.guard_config ?? "{}") as {
    checks?: { checkCmd?: string; lintCmd?: string; testCmd?: string; requireAllPass?: boolean; };
    guardFiles?: Record<string, string>;
    contracts?: { type: string; programId?: string; };
  };

  const results: Record<string, { passed: boolean; error?: string; detail?: string }> = {};
  let allPassed = true;

  // Check 1: Check command (e.g. pnpm build or cargo check)
  if (guardConfig.checks?.checkCmd) {
    try {
      execSync(guardConfig.checks.checkCmd, { cwd: localPath, timeout: 180_000, maxBuffer: 5 * 1024 * 1024 });
      results.check = { passed: true };
    } catch (e: any) {
      results.check = { passed: false, error: e.stderr?.toString().substring(0, 500) ?? e.message };
      allPassed = false;
    }
  }

  // Check 2: Lint
  if (guardConfig.checks?.lintCmd) {
    try {
      execSync(guardConfig.checks.lintCmd, { cwd: localPath, timeout: 120_000, maxBuffer: 5 * 1024 * 1024 });
      results.lint = { passed: true };
    } catch (e: any) {
      results.lint = { passed: false, error: e.stderr?.toString().substring(0, 500) ?? e.message };
      allPassed = false;
    }
  }

  // Check 3: Test (optional)
  if (guardConfig.checks?.testCmd) {
    try {
      execSync(guardConfig.checks.testCmd, { cwd: localPath, timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
      results.test = { passed: true };
    } catch (e: any) {
      results.test = { passed: false, error: e.stderr?.toString().substring(0, 500) ?? e.message };
      allPassed = false;
    }
  }

  // Check 4: Guard files — detect unexpected changes
  if (guardConfig.guardFiles && Object.keys(guardConfig.guardFiles).length > 0) {
    const guardIssues: string[] = [];
    const diffOut = gitOptional(localPath, "diff --name-only HEAD~1..HEAD");
    const changedFiles = diffOut.split("\n").filter(Boolean);

    for (const [pattern, label] of Object.entries(guardConfig.guardFiles)) {
      const matches = changedFiles.filter(f => {
        if (pattern.includes("*")) {
          const re = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
          return re.test(f);
        }
        return f === pattern;
      });

      if (matches.length > 0) {
        guardIssues.push(`Guard file changed: ${matches.join(", ")} [${label}] — verify intentional`);
      }
    }

    results.guardFiles = {
      passed: guardIssues.length === 0,
      detail: guardIssues.length > 0 ? guardIssues.join("; ") : "No guard files changed",
    };
    if (guardIssues.length > 0) allPassed = false;
  }

  // Check 5: Contract checks (Solana)
  if (guardConfig.contracts?.type === "solana" && guardConfig.contracts.programId) {
    const programIdPattern = guardConfig.contracts.programId;
    const declFiles = gitOptional(localPath, "grep -l declare_id || true").split("\n").filter(Boolean);
    let programIdOk = true;
    for (const f of declFiles) {
      const content = readFileSync(join(localPath, f), "utf-8");
      if (!content.includes(programIdPattern)) {
        programIdOk = false;
        results.contracts = { passed: false, error: `program_id changed or missing in ${f}` };
      }
    }
    if (programIdOk) {
      results.contracts = { passed: true, detail: `Program ID ${programIdPattern} verified` };
    } else {
      allPassed = false;
    }
  }

  return { passed: allPassed, checks: results };
}
