# Baseline Reference Card

| Config | Value |
|--------|-------|
| `contextInjection` | `always` |
| `compaction.reserveTokens` | `12000` |
| `compaction.keepRecentTokens` | `20000` |
| `compaction.maxHistoryShare` | `0.6` |
| `compaction.recentTurnsPreserve` | `3` |
| `compaction.notifyUser` | `true` |
| `gateway.bind` | `lan` |
| `deepseek.timeoutSeconds` | `300` |
| `session.reset.mode` | `idle` |
| `session.reset.idleMinutes` | `480` |
| `session.maintenance.pruneAfter` | `30d` |
| `session.maintenance.maxEntries` | `1000` |
| Agent count | 10 (1 architect + 9 subagents) |
| Security tools | 15/15 |
| Disk usage | < 80% |
| Gateway | must be running |

## Agent checklist

| # | Agent ID | Role |
|---|----------|------|
| 1 | architect (teamN) | Architect + product analyst |
| 2 | qa | L1+L2 functional review |
| 3 | security | L3 deep audit (85-item SCSVS) |
| 4 | security-check | Contract scanning |
| 5 | security-check-centralized | Centralized scanning |
| 6 | tester | E2E / forge / curl / browser |
| 7 | ui-design-critique | Independent design review |
| 8 | ux-researcher | UX research |
| 9 | design-advisor | Design inspiration |
| 10 | ui-designer | UI design spec generation |

## Security tools checklist

forge slither aderyn semgrep solhint echidna bandit
nmap nuclei nikto eslint lynis gitleaks trivy autotest

## Instance inventory

| IP | Team | Status |
|----|------|--------|
| `43.156.50.6` | team3 | baseline |
| `43.156.138.166` | team1 | pending |
| `43.156.55.212` | team2 | aligned |
| `43.133.37.213` | team3 (alt) | pending |
| `43.159.60.46` | team4 | aligned |
| `124.156.203.132` | team5 | pending |
| `129.226.203.60` | team6 | aligned |
