---
name: openclaw-instance-doctor
description: "Diagnose and align OpenClaw instances: cache-hit chain (stable prefix→retention→heartbeat→pruning→compaction), session mgmt, disk, browser, Gateway."
---

# OpenClaw Instance Doctor

Diagnose OpenClaw instance config and health. Core: cache-hit chain. Also: session mgmt, disk, browser. Show gaps → user approves → apply fixes.

## Constraints

- Stop Gateway before editing `openclaw.json`. Restart after.
- Never delete `~/.openclaw/agents/` (runtime storage with sqlite + sessions).
- Only remove `~/.openclaw/workspaces/` (old layout, plural).
- Don't touch workspace paths if they already work.

## Workflow

1. **Connect** — `sshpass -p '<PASSWORD>' ssh -o StrictHostKeyChecking=no ubuntu@<IP>`.
2. **Diagnose** — run `scripts/diagnose.sh` via SSH heredoc. Output 8-dimension report with cache-hit chain score.
3. **Analyze** — compare against `references/baseline.md`, present gap table.
4. **User decides** — list each gap with risk/cost. Wait for explicit approval.
5. **Apply** — disk clean → tools install → sync AGENTS.md → `fix-config.sh` → restart Gateway.
6. **Verify** — re-run diagnose.sh, confirm cache-hit chain = 7/7 + all gaps closed.

## Credentials

| Key | Value |
|-----|-------|
| User | ubuntu |
| Password | Asdf1234! |
| SSH timeout | ConnectTimeout=10 |

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/diagnose.sh` | 8-dimension health check + cache-hit chain score (7/7) |
| `scripts/cleanup-disk.sh` | Clean npm/pnpm/pip/go/apt/journal/tmp/trash |
| `scripts/fix-config.sh` | Patch openclaw.json to baseline (11 checks, run after Gateway stop) |
| `scripts/restart-gateway.sh` | Stop → verify → start → verify UP on port |

## Related

- Full SOP: `docs/openclaw-alignment-sop.md`
- Agent repo: `github.com/sftgroup/agent`
