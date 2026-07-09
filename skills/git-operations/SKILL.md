---
name: git-operations
description: "Centralized git workflow via git-mcp. Agent must use MCP tools for all push/pull/checkout/tag actions."
user-invocable: true
metadata: { "openclaw": { "os": ["linux"] } }
---

# Git Operations — Centralized Workflow via git-mcp

> All git operations go through git-mcp. Never use raw `git` CLI directly.
> MCP stores every commit incrementally — no overwrites, full history preserved locally.
> GitHub push is a separate, deliberate action (`git_sync`).

## MCP Dependency

| Item | Value |
|------|-------|
| **MCP server** | git-mcp |
| **URL** | `http://<server>:3082` |
| **All tools below** | call via OpenClaw MCP protocol, NOT curl/HTTP |

## Architecture

```
agent → git_push    → MCP local repo (incremental, NEVER overwrites)
agent → git_sync    → GitHub (deliberate push, YOU decide when)
agent → repo_sync   → MCP local (rsync from test servers, returns SHA)
agent → repo_snapshot → get SHA for code-review traceability

code-review-mcp → /opt/mcp/repos/<team>/ → reports tagged with SHA
```

---

## Tool Quick Reference by Scenario

### 🟢 Daily Push (code change → save → publish)

| Step | Tool | Key params |
|------|------|------------|
| 1 | `git_pull` | `name` |
| 2 | `git_status` | `name` |
| 3 | `repo_check` | `name` |
| 4 | `git_push` | `name`, `message` |
| 5 | `git_sync` | `name` |

### 🔵 Code Review (test server → audit)

| Step | Tool | Key params |
|------|------|------------|
| 1 | `repo_sync` | `team`, `source_host`, `source_path` |
| 2 | `repo_snapshot` | `team` |
| 3 | → pass `sha` to code-review-mcp `review_all` | `project_path`, `language` |

### 🟡 Release (tag a version)

| Step | Tool | Key params |
|------|------|------------|
| 1 | `git_sync` | `name`, `tag` (e.g. `"v1.2.0"`) |
| 2 | `git_create_tag` | `name`, `tag` |

### 🟠 Lookup (inspect / find / audit)

| Need | Tool | Key params |
|------|------|------------|
| Find repos | `repo_list` | `search` (optional) |
| Repo details | `repo_info` | `name` |
| Commit history | `git_log` | `name`, `limit` |
| Version tags | `git_tags` | `name` |
| Switch branch | `git_checkout` | `name`, `ref` |
| Audit trail | `git_audit` | `name` (optional) |
| Unsynced commits | `git_sync_status` | `name` (optional, omit for all) |
| Create new repo | `git_create_repo` | `name`, `description` |

---

## Push Workflow (MANDATORY — Step by Step)

```
1. git_pull("name")           — Pull latest from GitHub into MCP local
2. git_status("name")         — Confirm what changed
3. repo_check("name")         — Integrity checks (build + lint + guardFiles + contracts)
4. git_push("name", "message") — Commit to MCP local (incremental)
5. git_sync("name")           — Push MCP-local commits to GitHub
```

**After `git_push`:** always check the returned `unsyncedCommits`. If > 0, run `git_sync`.

**If repo_check fails:** fix errors then re-run. Don't skip checks unless user says so.

**If push fails (conflict):** report exact error to user. Don't force-push without permission.

---

## Code Review Flow

```
1. repo_sync("team3", "43.156.50.6", "/path/to/project")
   → { sha: "abc123", fileCount: 42 }

2. Pass sha to code-review-mcp:
   review_all("/opt/mcp/repos/team3", "all")
   → Report MUST include snapshot_sha: "abc123"

3. repo_snapshot("team3") — get SHA without re-syncing
```

**Traceability rule:** Every code review report must include `snapshot_sha`.

---

## Commit Message Rules (MANDATORY)

**Format:** `type(scope): what changed`

```
<type>(<scope>): <what changed — be specific>

<body: why, what problem, which files, before/after>
```

**Types:** `feat` `fix` `refactor` `docs` `chore` `test` `perf` `security`
**Scopes:** `mcp` `skill` `contract` `frontend` `api` `docker` `mobile` `db` `config`

**Body MUST include:**
1. What was changed (specific files/modules)
2. Why it was changed
3. What effect it has (before/after)

**✅ Good:**
```
fix(solana-mcp): use temp file for deploy keypair instead of stdin piping

Before: echo keypair | solana deploy --keypair /dev/stdin leaked private key
in process list. After: write keypair to temp file with chmod 600, pass via
--keypair flag, immediate unlink after deploy. Modified: deploy.ts.
```

**❌ Rejected:** `update code` / `fix bug` / `v1.2` / `wip`

**Agent: write the commit message yourself.** Inspect `git_status` to see changed files, then describe them. Don't ask the user.

---

## NEVER Do These

- ❌ Raw `git push/pull` via exec — no audit, no checks, no incremental storage
- ❌ Vague commit messages like "fix", "update", "wip"
- ❌ Force-push unless user explicitly commands it
- ❌ Push when `repo_check` failed without user approval
- ❌ Push when `guardFiles` changed without explaining why
- ❌ Skip `repo_check` before pushing
- ❌ Skip `git_sync` and leave commits unsynced indefinitely

---

## Guard Config Reference

```json
{
  "checks": { "checkCmd": "pnpm build", "lintCmd": "pnpm lint", "testCmd": null },
  "guardFiles": { "src/processor.rs": "solana", "contracts/*.sol": "evm" },
  "contracts": { "type": "solana", "programId": "Gw8rwk9w8HNn8Emcgximggy9gtxxQaA7q6hHqboUT8aE" }
}
```

- `guardFiles` — files that must change intentionally
- `contracts.programId` — prevents accidental program_id changes
- `checks` — build/lint/test commands run by `repo_check`
