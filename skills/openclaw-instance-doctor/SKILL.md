---
name: openclaw-instance-doctor
description: "Diagnose and align OpenClaw instances: config (contextInjection/compaction/cache), session mgmt, disk cleanup, browser cleanup, Gateway health."
---

# OpenClaw Instance Doctor

Diagnose OpenClaw instance configuration and health. Focus: config optimization (cache hit), session management, disk/browser maintenance. Show gaps → user approves → apply fixes.

## Constraints

- Stop Gateway before editing `openclaw.json`. Restart after.
- Never delete `~/.openclaw/agents/` (runtime storage with sqlite + sessions).
- Only remove `~/.openclaw/workspaces/` (old layout, plural).
- Don't touch workspace paths if they already work.

## Workflow

1. **Connect** — `sshpass -p '<PASSWORD>' ssh -o StrictHostKeyChecking=no ubuntu@<IP>`.
2. **Diagnose** — run `scripts/diagnose.sh` via SSH heredoc. Output 8-dimension report.
3. **Analyze** — compare against `references/baseline.md`, present gap table.
4. **User decides** — list each gap with risk/cost. Wait for explicit approval.
5. **Apply** — disk clean → tools install → sync AGENTS.md → patch config → restart Gateway.
6. **Verify** — re-run diagnose.sh, confirm all gaps closed.

## Credentials

| Key | Value |
|-----|-------|
| User | ubuntu |
| Password | Asdf1234! |
| SSH timeout | ConnectTimeout=10 |

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/diagnose.sh` | 8-dimension health check via SSH heredoc |
| `scripts/cleanup-disk.sh` | Clean npm/pnpm/pip/go/apt/journal/tmp/trash |
| `scripts/fix-config.sh` | Patch openclaw.json to baseline (run after Gateway stop) |
| `scripts/restart-gateway.sh` | Stop → verify → start → verify UP on port |

## Related

- Full SOP: `docs/openclaw-alignment-sop.md`
- Agent repo: `github.com/sftgroup/agent`
