---
name: git-operations
description: "Centralized git workflow via git-mcp. Agent must use MCP tools for all push/pull/checkout/tag actions."
user-invocable: true
metadata: { "openclaw": { "os": ["linux"] } }
---

# Git Operations — Centralized Workflow

> All git operations must go through the git-mcp server. Never use raw `git` CLI directly.
> The MCP server enforces integrity checks, prevents accidental overwrites, and logs every action.

---

## When to Use Each Tool

| Situation | Tool | Why |
|-----------|------|-----|
| Want to push code | `git_push` | Auto-pull → integrity check → commit → push. Has guard files and build/lint checks. |
| Need latest code | `git_pull` | Refuses if you have uncommitted changes. |
| Want to see what changed | `git_status` | Shows staged/unstaged/untracked, branch, commit SHA. |
| Need a version tag | `git_create_tag` | Creates annotated tag + pushes. |
| Checking version history | `git_tags` | Lists all tags for the repo. |
| Switching branch/version | `git_checkout` | Refuses if working tree is dirty. |
| Looking at recent commits | `git_log` | Shows oneline format, adjustable limit. |
| Before pushing — mandatory | `repo_check` | Runs build, lint, guardFiles, contract verification. |
| Finding a repo | `repo_list` | Search by name/description/tags. |
| Seeing repo details | `repo_info` | Latest tag, all tags, metadata. |
| Creating a new GitHub repo | `git_create_repo` | Creates on GitHub + registers locally. |

---

## Push Workflow (MANDATORY)

**The agent must follow this sequence for every push:**

```
Step 1: git_pull       — ensure you have latest
Step 2: git_status     — confirm what changed
Step 3: repo_check     — run integrity checks (build + lint + guardFiles + contracts)
Step 4: git_push       — only if all checks passed
```

**If any check fails:** Fix the error and re-run `repo_check`. Do NOT skip checks unless the user explicitly says so.

**If push fails (= conflict or integrity error):** Report the exact error to the user. Do not try to force-push without permission.

---

## Pull Workflow

```
Step 1: git_status     — ensure working tree is clean
Step 2: git_pull       — if dirty, commit/stash first
```

---

## NEVER Do These

- ❌ Run `git push` or `git pull` directly via exec — no audit, no checks
- ❌ Force-push unless the user explicitly commands it
- ❌ Push when `repo_check` failed without user approval
- ❌ Push when `guardFiles` changed without explaining why
- ❌ Skip `repo_check` before pushing
- ❌ Push when `git_status` shows unexpected changes

---

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

---

## Example: Pushing a change

```
# Agent sees user wants to push

# Step 1: pull latest
POST /tools/git_pull  {"name": "contra-ai"}
→ { ok: true, afterSha: "abc123" }

# Step 2: check status
POST /tools/git_status  {"name": "contra-ai"}
→ { dirty: true, staged: 3, files: ["src/processor.rs"] }

# Step 3: run integrity checks
POST /tools/repo_check  {"name": "contra-ai"}
→ { passed: true, checks: { build: {passed:true}, guardFiles: {passed:true, detail:"No guard files changed"}, contracts: {passed:true, detail:"Program ID verified"} } }

# Step 4: push
POST /tools/git_push  {"name": "contra-ai", "message": "fix: treasury forward CPI signer seeds"}
→ { ok: true, commitSha: "def456", checks: {...} }
```

## Example: Finding repos

```
# Searching
POST /tools/repo_list  {"search": "solana"}
→ { repos: [{name: "contra-ai", description: "NFT minting program", ...}] }

# Getting details
POST /tools/repo_info  {"name": "contra-ai"}
→ { repo: {...}, latestTag: "v1.1.0", tags: [...] }
```

## MCP Server URL

The git-mcp server is at `http://<server>:3082`. All tools accessible via `POST /tools/:name`.
