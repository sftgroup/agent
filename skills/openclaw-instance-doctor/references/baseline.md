# Baseline Reference Card

## Config (cache hit optimization) ⭐

| Config | Value | Why |
|--------|-------|-----|
| `contextInjection` | `always` | Full bootstrap per turn → stable prefix → high cache hit |
| `cacheRetention` | `"long"` | DeepSeek via OpenRouter: 1h cache TTL, auto cache_control injection |
| `heartbeat.every` | `"55m"` | Keep-warm before cache TTL expires → no cold-start re-cache |
| `contextPruning.mode` | `"cache-ttl"` | Prune old tool results after TTL → smaller cache-write |
| `contextPruning.ttl` | `"1h"` | Match cache TTL window |
| `compaction.reserveTokens` | `12000` | Reserve 12K for summary after compaction |
| `compaction.keepRecentTokens` | `20000` | Keep last 20K of conversation uncompressed |
| `compaction.maxHistoryShare` | `0.6` | History ≤60% of context window |
| `compaction.recentTurnsPreserve` | `3` | Always keep last 3 turns complete |
| `compaction.notifyUser` | `true` | Notify user when compacting |
| `skipOptionalBootstrapFiles` | `["SOUL.md","HEARTBEAT.md","IDENTITY.md","USER.md"]` | Skip absent files → no 404 cost in bootstrap |
| `bootstrapMaxChars` | `20000` | Per-file ceiling, avoid oversized AGENTS.md |
| `bootstrapTotalMaxChars` | `50000` | Upper ceiling for all bootstrap files (enough for 10 agents) |
| `deepseek.timeoutSeconds` | `300` | Matches model latency profile |

### Cache-hit chain (DeepSeek via OpenRouter)

```
稳定前缀    contextInjection:always
              ↓ skipOptional → no 404 in bootstrap
Cache 写入   OpenRouter auto-injects cache_control markers
              ↓
Cache 留存    cacheRetention:long → 1h TTL
              ↓
保活          heartbeat:55m → never expires
              ↓
瘦身          contextPruning → old tool output trimmed
              ↓
下一请求      prefix 不变 → cacheRead 命中 → 省 token + 快响应
```

## Gateway

| Config | Value |
|--------|-------|
| `gateway.bind` | `lan` |
| Model primary | `deepseek/deepseek-v4-pro` |
| Security (L3) model | `zhipu/glm-5.2` |

## Session Management

| Config | Value |
|--------|-------|
| `session.reset.mode` | `idle` |
| `session.reset.idleMinutes` | `480` (8h) |
| `session.maintenance.mode` | `enforce` |
| `session.maintenance.pruneAfter` | `30d` |
| `session.maintenance.maxEntries` | `1000` |
| `session.resetArchiveRetention` | `7d` |

## Agent layout

| # | Agent ID | Role |
|---|----------|------|
| 1 | architect (teamN) | Architect + product analyst |
| 2 | qa | L1+L2 functional review |
| 3 | security | L3 deep audit |
| 4 | security-check | Contract scanning |
| 5 | security-check-centralized | Centralized scanning |
| 6 | tester | E2E / forge / curl / browser |
| 7 | ui-design-critique | Design review |
| 8 | ux-researcher | UX research |
| 9 | design-advisor | Design inspiration |
| 10 | ui-designer | UI design spec |

## Browser maintenance

| Item | Frequency |
|------|-----------|
| L1 chrome-cleanup.sh | crontab every 10min, kill idle>30m renderer |
| L2 kill-idle-browser.sh | crontab every 30min, kill idle>2h main process |

## Disk health

| Threshold | Action |
|-----------|--------|
| < 60% | Healthy, nothing needed |
| 60-80% | Monitor |
| 80-90% | Clean (npm/pnpm/journal/pip/apt/tmp) |
| > 90% | Urgent clean + Solana cache + browser cache |

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
