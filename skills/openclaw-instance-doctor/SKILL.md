---
name: openclaw-instance-doctor
description: "Diagnose and align remote OpenClaw instances across 10 dimensions (agents, config, tools, Qdrant, disk)."
---

# OpenClaw Instance Doctor

Diagnose remote OpenClaw instances across 10 dimensions. Show gaps → user approves → apply fixes. Never modify before user confirms.

## Constraints

- Stop Gateway before editing `openclaw.json`. Restart after.
- Never delete `~/.openclaw/agents/` (runtime storage with sqlite + sessions).
- Only remove `~/.openclaw/workspaces/` (old layout, plural).
- Don't touch workspace paths if they already work.

## Workflow

1. **Connect** — `sshpass -p '<PASSWORD>' ssh -o StrictHostKeyChecking=no ubuntu@<IP>` to confirm reachable.
2. **Diagnose** — run `scripts/diagnose.sh` on target via SSH heredoc. Output structured 10-dimension report.
3. **Analyze** — compare against baseline card (see references/baseline.md), present gap table with ✅/⚠️/❌.
4. **User decides** — list each gap, its risk, and cost. Wait for explicit approval per item.
5. **Apply** — execute approved fixes (disk clean → tools install → sync AGENTS.md → patch config → restart Gateway).
6. **Verify** — re-run diagnose.sh, confirm all gaps closed.

## Credentials

| Key | Value |
|-----|-------|
| User | ubuntu |
| Password | Asdf1234! |
| SSH timeout | ConnectTimeout=10 |

## Related

- Full SOP: `docs/openclaw-alignment-sop.md`
- Agent repo: `github.com/sftgroup/agent`
- Qdrant: `182.254.140.44:6333`
