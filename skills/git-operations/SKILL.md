---
name: git-operations
description: "Centralized git workflow via git-mcp. Agent must use MCP tools for all push/pull/checkout/tag actions."
user-invocable: true
metadata: { "openclaw": { "os": ["linux"] } }
---

# Git Operations — Centralized Workflow with Incremental Storage

> All git operations must go through the git-mcp server. Never use raw `git` CLI directly.
> The MCP server stores every commit incrementally — no overwrites, full history preserved locally.
> Pushing to GitHub is a separate, deliberate action (`git_sync`).

## Architecture

```
agent → git_push → MCP local repo (incremental, never overwrites)
agent → git_sync → GitHub (deliberate push)
```

Every `git_push` creates a commit in the MCP's local repository. These accumulate as a permanent audit trail.
Only `git_sync` actually pushes to GitHub. This separation prevents accidental overwrites.

## When to Use Each Tool

| Situation | Tool | Why |
|-----------|------|-----|
| Want to save code | `git_push` | Commit to MCP local (incremental, no GitHub push) |
| Ready to publish to GitHub | `git_sync` | Push MCP-local commits to GitHub |
| Check what's not synced | `git_sync_status` | Show unsynced commits per repo |
| Need latest code (from GitHub) | `git_pull` | Pull from GitHub to MCP local |
| Want to clone a repo | `git_clone` | Clone from GitHub to MCP local |
| Want to see what changed | `git_status` | Shows staged/unstaged/untracked + unsynced count |
| Need a version tag | `git_create_tag` | Creates annotated tag + pushes |
| Checking version history | `git_tags` | Lists all tags for the repo |
| Switching branch/version | `git_checkout` | Refuses if working tree is dirty |
| Looking at recent commits | `git_log` | Shows oneline format, adjustable limit |
| Before pushing — mandatory | `repo_check` | Runs build, lint, guardFiles, contract verification |
| Finding a repo | `repo_list` | Search by name/description/tags |
| Seeing repo details | `repo_info` | Latest tag + unsynced count |
| Creating a new GitHub repo | `git_create_repo` | Creates on GitHub + registers locally |

## Push Workflow (MANDATORY)

**The agent must follow this sequence for every code change:**

```
Step 1: git_pull       — Pull latest from GitHub into MCP local
Step 2: git_status     — Confirm what changed
Step 3: repo_check     — Run integrity checks (build + lint + guardFiles + contracts)
Step 4: git_push       — Commit to MCP local (incremental storage)
Step 5: git_sync       — Push MCP-local commits to GitHub
```

**After git_push, always check `unsyncedCommits` and `hint` in the response.**

If `hint` says "WARNING: N local commit(s) not synced" — you MUST eventually run `git_sync`.

**If any check fails:** Fix the error and re-run `repo_check`. Do NOT skip checks unless the user explicitly says so.

**If push fails (= conflict or integrity error):** Report the exact error to the user. Do not try to force-push without permission.

## Sync to GitHub

```
# After git_push, push to GitHub:
POST /tools/git_sync  {"name": "contra-ai"}

# Optionally create a version tag:
POST /tools/git_sync  {"name": "contra-ai", "tag": "v1.2.0"}

# Check all repos for unsynced commits:
POST /tools/git_sync_status  {}
```

`git_sync_status` without `name` checks ALL repos — useful for periodic audits.

## Pull Workflow

```
Step 1: git_status     — Ensure working tree is clean
Step 2: git_pull       — If dirty, commit/stash first
```

## NEVER Do These

- ❌ Run `git push` or `git pull` directly via exec — no audit, no checks, no incremental storage
- ❌ Force-push unless the user explicitly commands it
- ❌ Push when `repo_check` failed without user approval
- ❌ Push when `guardFiles` changed without explaining why
- ❌ Skip `repo_check` before pushing
- ❌ Push when `git_status` shows unexpected changes
- ❌ Skip `git_sync` and leave commits unsynced indefinitely

## Guard Config Reference

When registering repos, set `guard_config` to enable integrity checks:

```json
{
  "checks": {
    "checkCmd": "pnpm build",
    "lintCmd": "pnpm lint",
    "testCmd": null
  },
  "guardFiles": {
    "src/processor.rs": "solana",
    "contracts/*.sol": "evm",
    "Cargo.toml": "manifest"
  },
  "contracts": {
    "type": "solana",
    "programId": "Gw8rwk9w8HNn8Emcgximggy9gtxxQaA7q6hHqboUT8aE"
  }
}
```

- `guardFiles` — files that must change intentionally, not accidentally
- `contracts.programId` — prevents accidental program_id changes in Solana projects
- `checks.checkCmd` — run build to confirm code compiles
- `checks.lintCmd` — run lint to confirm code quality

## Example: Full Push Flow

```
# Step 1: pull latest from GitHub
POST /tools/git_pull  {"name": "contra-ai"}
→ { ok: true, afterSha: "abc123" }

# Step 2: check status
POST /tools/git_status  {"name": "contra-ai"}
→ { dirty: true, staged: 3, files: ["src/processor.rs"], unsyncedCommits: 0 }

# Step 3: run integrity checks
POST /tools/repo_check  {"name": "contra-ai"}
→ { passed: true, checks: { build: {passed:true}, guardFiles: {passed:true}, contracts: {passed:true} } }

# Step 4: push to MCP local (incremental storage)
POST /tools/git_push  {"name": "contra-ai", "message": "fix: treasury forward CPI signer seeds"}
→ { ok: true, stored: true, commitSha: "def456", unsyncedCommits: 1,
    hint: "WARNING: 1 local commit(s) not synced to GitHub. Run git_sync when ready." }

# Step 5: sync to GitHub
POST /tools/git_sync  {"name": "contra-ai"}
→ { ok: true, synced: 1, commits: [{sha:"def456", message:"fix: treasury forward..."}] }
```

## Example: Check Sync Status

```
# Check all repos
POST /tools/git_sync_status  {}
→ { repos: [
    { name: "contra-ai", unsynced: 3, commits: [...] },
    { name: "agent", unsynced: 0, commits: [] }
  ]}
```

## MCP Server URL

The git-mcp server is at `http://<server>:3082`. All tools accessible via `POST /tools/:name`.
