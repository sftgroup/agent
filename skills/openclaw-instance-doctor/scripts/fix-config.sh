#!/usr/bin/env bash
# OpenClaw Instance Doctor — fix config to baseline (11 checks)
# Patches: cache chain (retention/heartbeat/pruning) + compaction + bootstrap + session
# Usage: bash fix-config.sh
# Run AFTER stopping Gateway.

set -e

CFG="$HOME/.openclaw/openclaw.json"
[ ! -f "$CFG" ] && echo "❌ $CFG not found" && exit 1

python3 << 'PYEOF'
import json, sys

CFG = "/home/ubuntu/.openclaw/openclaw.json"
with open(CFG) as f:
    c = json.load(f)

d = c["agents"]["defaults"]

# 1. contextInjection (stable prefix)
if d.get("contextInjection") != "always":
    print(f"fix: contextInjection {d.get('contextInjection')} → always")
    d["contextInjection"] = "always"

# 2. skipOptional (no 404 in bootstrap)
target_skip = ["SOUL.md", "HEARTBEAT.md", "IDENTITY.md", "USER.md"]
if d.get("skipOptionalBootstrapFiles") != target_skip:
    print(f"fix: skipOptional → {target_skip}")
    d["skipOptionalBootstrapFiles"] = target_skip

# 3. compaction baseline
comp = d.get("compaction", {})
target_comp = {"reserveTokens": 12000, "keepRecentTokens": 20000, "maxHistoryShare": 0.6, "recentTurnsPreserve": 3, "notifyUser": True}
for k, v in target_comp.items():
    if comp.get(k) != v:
        print(f"fix: compaction.{k} {comp.get(k)} → {v}")
        comp[k] = v
d["compaction"] = comp

# 4. deepseek timeout
ds = c.get("models", {}).get("providers", {}).get("deepseek", {})
if ds.get("timeoutSeconds") != 300:
    print(f"fix: deepseek.timeoutSeconds {ds.get('timeoutSeconds')} → 300")
    ds["timeoutSeconds"] = 300

# 5. gateway bind
if c.get("gateway", {}).get("bind") != "lan":
    print(f"fix: gateway.bind {c.get('gateway',{}).get('bind')} → lan")
    c["gateway"]["bind"] = "lan"

# 6. cacheRetention (DeepSeek via OpenRouter → 1h TTL)
params = d.get("params", {})
if params.get("cacheRetention") != "long":
    print(f"fix: cacheRetention {params.get('cacheRetention','NOT SET')} → long")
    params["cacheRetention"] = "long"
    d["params"] = params

# 7. heartbeat keep-warm (55m fits inside 1h cache TTL)
if not d.get("heartbeat", {}).get("every"):
    d["heartbeat"] = {"every": "55m"}
    print("fix: heartbeat.every added (55m)")

# 8. contextPruning (trim old tool results after TTL)
pruning = d.get("contextPruning", {})
if pruning.get("mode") != "cache-ttl":
    print(f"fix: contextPruning.mode {pruning.get('mode','NOT SET')} → cache-ttl")
    pruning["mode"] = "cache-ttl"
    pruning["ttl"] = "1h"
    d["contextPruning"] = pruning

# 9. bootstrapTotalMaxChars (enough for 10 agents)
if d.get("bootstrapTotalMaxChars", 0) < 50000:
    print(f"fix: bootstrapTotalMaxChars {d.get('bootstrapTotalMaxChars','NOT SET')} → 50000")
    d["bootstrapTotalMaxChars"] = 50000

# 10. session management
s = c.get("session", {})
if not s.get("reset"):
    s["reset"] = {"mode": "idle", "idleMinutes": 480}
    print("fix: session.reset added")
if not s.get("maintenance"):
    s["maintenance"] = {"mode": "enforce", "pruneAfter": "30d", "maxEntries": 1000, "resetArchiveRetention": "7d"}
    print("fix: session.maintenance added")
c["session"] = s

# 11. clean stale agents
KEEP = {"team3", "team2", "team4", "team5", "team6", "team1", "product-chain",
        "qa", "security", "security-check", "security-check-centralized",
        "tester", "ui-design-critique", "ux-researcher", "design-advisor", "ui-designer"}
stale = [a["id"] for a in c["agents"]["list"] if a["id"] not in KEEP]
if stale:
    print(f"fix: removing stale agents: {stale}")
    c["agents"]["list"] = [a for a in c["agents"]["list"] if a["id"] in KEEP]

with open(CFG, "w") as f:
    json.dump(c, f, indent=2, ensure_ascii=False)

print("✅ config fixed (11 checks)")
PYEOF
