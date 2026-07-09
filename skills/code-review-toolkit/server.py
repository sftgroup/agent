#!/usr/bin/env python3
"""
Code Review MCP Server v3.3.1 — local filesystem mode + REST API + aggregated report
Deploy on central MCP server. All team code lives on this server (git-managed).
Review runs locally over /opt/mcp/repos/<team>/.

Tools:
  - review_lint(project_path, language)     → lint results (solhint/eslint/ruff/shellcheck)
  - review_format(project_path, language)   → format check (forge fmt/prettier/black/shfmt)
  - review_types(project_path, language)    → type check (tsc/mypy)
  - review_complexity(project_path)         → cyclomatic complexity (radon/eslint)
  - review_deps(project_path)               → npm audit / pip-audit
  - review_all(project_path, language)      → full suite (all 5 layers)

Unified response: { status, project, language, summary, results }
"""

import json
import subprocess
import os
import sys
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
log = logging.getLogger("code-review-mcp")

# Path whitelist — all project paths must be under this root
REPOS_ROOT = "/opt/mcp/repos"


def validate_path(project_path: str) -> str | None:
    """Reject paths outside REPOS_ROOT. Returns error message or None."""
    if not os.path.isdir(project_path):
        return f"project not found: {project_path}"
    real = os.path.realpath(project_path)
    if not real.startswith(os.path.realpath(REPOS_ROOT)):
        return f"project path must be under {REPOS_ROOT}, got: {project_path}"
    return None


def find_files(project_path: str, extensions: list[str]) -> list[str]:
    exclude = {'node_modules', 'lib', 'dist', 'build', '.git', 'venv', '.venv',
               '__pycache__', 'forge-std', 'openzeppelin', '.foundry', 'cache'}
    files = []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in exclude]
        for f in filenames:
            if any(f.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, f))
    return files


def run(cmd: list[str], cwd: Optional[str] = None, timeout: int = 120) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError:
        return -1, "", "tool not found"
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"


def review_lint(project_path: str, language: str) -> dict:
    results = []

    if language in ("solidity", "all"):
        sol_files = find_files(project_path, ['.sol'])
        if sol_files:
            rc, out, err = run(["solhint"] + sol_files)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line and (":" in line[:20] or "error" in line.lower() or "warning" in line.lower() or "✓" in line):
                    results.append({"tool": "solhint", "file": "", "message": line, "severity": "P1"})

    if language in ("js-ts", "all"):
        ts_files = find_files(project_path, ['.ts', '.tsx', '.js', '.jsx'])
        if ts_files:
            rc, out, err = run(["eslint", "--format", "compact"] + ts_files)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line:
                    results.append({"tool": "eslint", "file": "", "message": line, "severity": "P1"})

    if language in ("python", "all"):
        py_files = find_files(project_path, ['.py'])
        if py_files:
            rc, out, err = run(["ruff", "check"] + py_files)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line:
                    results.append({"tool": "ruff", "file": "", "message": line, "severity": "P1"})

    if language in ("shell", "all"):
        sh_files = find_files(project_path, ['.sh'])
        if sh_files:
            rc, out, err = run(["shellcheck"] + sh_files)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line:
                    results.append({"tool": "shellcheck", "file": "", "message": line[:200], "severity": "P1"})

    p0 = sum(1 for i in results if i["severity"] == "P0")
    p1 = sum(1 for i in results if i["severity"] == "P1")
    return {
        "status": "ok",
        "project": project_path,
        "language": language,
        "summary": f"{len(results)} issues ({p0} P0, {p1} P1)",
        "p0_count": p0,
        "p1_count": p1,
        "issues": results
    }


def review_format(project_path: str, language: str) -> dict:
    results = []

    if language in ("solidity", "all"):
        rc, out, err = run(["forge", "fmt", "--check"], cwd=project_path, timeout=30)
        results.append({"tool": "forge fmt", "language": "solidity", "ok": rc == 0, "output": (out + err)[:500], "severity": "P1" if rc != 0 else "P0"})

    if language in ("js-ts", "all"):
        ts_files = find_files(project_path, ['.ts', '.tsx', '.js', '.jsx'])
        if ts_files:
            rc, out, err = run(["npx", "prettier", "--check"] + ts_files, timeout=60)
            results.append({"tool": "prettier", "language": "js-ts", "ok": rc == 0, "output": (out + err)[:500], "severity": "P1" if rc != 0 else "P0"})

    if language in ("python", "all"):
        py_files = find_files(project_path, ['.py'])
        if py_files:
            rc, out, err = run(["black", "--check", "--diff"] + py_files, timeout=60)
            results.append({"tool": "black", "language": "python", "ok": rc == 0, "output": (out + err)[:500], "severity": "P1" if rc != 0 else "P0"})

    if language in ("shell", "all"):
        sh_files = find_files(project_path, ['.sh'])
        if sh_files:
            rc, out, err = run(["shfmt", "-d"] + sh_files, timeout=30)
            results.append({"tool": "shfmt", "language": "shell", "ok": rc == 0, "output": (out + err)[:500], "severity": "P1" if rc != 0 else "P0"})

    failures = [r for r in results if not r["ok"]]
    return {
        "status": "ok",
        "project": project_path,
        "language": language,
        "summary": f"{len(failures)}/{len(results)} tools found format issues" if failures else "all format checks passed",
        "results": results
    }


def review_types(project_path: str, language: str) -> dict:
    results = []

    tsconfig = os.path.join(project_path, "tsconfig.json")
    if language in ("js-ts", "all") and os.path.exists(tsconfig):
        rc, out, err = run(["npx", "tsc", "--noEmit"], cwd=project_path, timeout=60)
        issues = []
        for line in (out + "\n" + err).split("\n"):
            line = line.strip()
            if line and "error TS" in line:
                issues.append(line)
        results.append({"tool": "tsc", "language": "js-ts", "ok": rc == 0, "issueCount": len(issues), "issues": issues[:20], "severity": "P1" if rc != 0 else "P0"})

    if language in ("python", "all"):
        py_files = find_files(project_path, ['.py'])
        if py_files:
            rc, out, err = run(["mypy"] + py_files, timeout=60)
            issues = [l.strip() for l in (out + "\n" + err).split("\n") if l.strip()]
            results.append({"tool": "mypy", "language": "python", "ok": rc == 0, "issueCount": len(issues), "issues": issues[:20], "severity": "P1" if rc != 0 else "P0"})

    p0 = sum(1 for r in results if r["severity"] == "P0" and not r["ok"])
    return {
        "status": "ok",
        "project": project_path,
        "language": language,
        "summary": f"{p0} tools with type errors" if p0 > 0 else "all type checks passed",
        "results": results
    }


def review_complexity(project_path: str) -> dict:
    results = {}

    py_files = find_files(project_path, ['.py'])
    if py_files:
        rc, out, err = run(["radon", "cc"] + py_files + ["-a", "-s"], timeout=60)
        complexity = []
        for line in out.split("\n"):
            parts = line.strip().split()
            if len(parts) >= 3 and parts[-1].startswith(('F', 'C', 'M')):
                complexity.append({"function": parts[0], "complexity": parts[-2], "rank": parts[-1]})
        high = [c for c in complexity if c["rank"] in ("D", "E", "F")]
        results["python"] = {"total": len(complexity), "high_complexity": high}

    ts_files = find_files(project_path, ['.ts', '.tsx'])
    if ts_files:
        rc, out, err = run(["eslint"] + ts_files + ["--rule", "complexity: [warn, 10]", "--rule", "max-lines-per-function: [warn, {max: 80}]", "--format", "compact"], timeout=60)
        issues = [l.strip() for l in out.split("\n") if l.strip() and "complexity" in l.lower()]
        results["typescript"] = {"issueCount": len(issues), "issues": issues[:20]}

    return {
        "status": "ok",
        "project": project_path,
        "summary": "complexity analysis complete",
        "results": results
    }


def review_deps(project_path: str) -> dict:
    results = {}

    pkg_json = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_json):
        rc, out, err = run(["npm", "audit", "--json"], cwd=project_path, timeout=120)
        if out.startswith("{"):
            try:
                data = json.loads(out)
                results["npm"] = data.get("metadata", {}).get("vulnerabilities", {})
            except json.JSONDecodeError:
                results["npm"] = {"raw": out[:500]}

    req_files = find_files(project_path, ['requirements.txt'])
    if req_files:
        rc, out, err = run(["pip-audit", "-r", req_files[0], "--format", "json"], timeout=120)
        if out.startswith("[") or out.startswith("{"):
            try:
                results["python"] = json.loads(out)
            except json.JSONDecodeError:
                results["python"] = {"raw": out[:500]}

    return {
        "status": "ok",
        "project": project_path,
        "summary": "dependency audit complete",
        "results": results
    }


# --- MCP HTTP Handler ---

import http.server
import urllib.parse

TOOLS = {
    "review_lint": {
        "description": "Lint checks (solhint/eslint/ruff/shellcheck) on code under /opt/mcp/repos/. Returns unified result with severity.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string", "description": "Project path on MCP server, e.g. /opt/mcp/repos/team3"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "shell", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "review_format": {
        "description": "Format check (forge fmt/prettier/black/shfmt) on code under /opt/mcp/repos/.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "shell", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "review_types": {
        "description": "Type check (tsc/mypy) on code under /opt/mcp/repos/.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["js-ts", "python", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "review_complexity": {
        "description": "Code complexity analysis (radon/eslint) on code under /opt/mcp/repos/.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_deps": {
        "description": "Dependency vulnerability audit (npm audit/pip-audit) on code under /opt/mcp/repos/.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_all": {
        "description": "Full code review (lint+format+types+complexity+deps) on code under /opt/mcp/repos/.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "shell", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "report": {
        "description": "Aggregated quality report — runs review_all and returns scored summary with breakdown.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "shell", "all"]}
            },
            "required": ["project_path"]
        }
    }
}


def call_tool(tool_name: str, args: dict) -> dict:
    pp = args["project_path"]
    lang = args.get("language", "all")

    # Path validation
    err = validate_path(pp)
    if err:
        return {"status": "error", "error": err}

    if tool_name == "review_lint":
        return review_lint(pp, lang)
    elif tool_name == "review_format":
        return review_format(pp, lang)
    elif tool_name == "review_types":
        return review_types(pp, lang)
    elif tool_name == "review_complexity":
        return review_complexity(pp)
    elif tool_name == "review_deps":
        return review_deps(pp)
    elif tool_name == "review_all":
        return {
            "status": "ok",
            "project": pp,
            "language": lang,
            "summary": "full review complete",
            "results": {
                "lint": review_lint(pp, lang),
                "format": review_format(pp, lang),
                "types": review_types(pp, lang),
                "complexity": review_complexity(pp),
                "deps": review_deps(pp),
            }
        }
    elif tool_name == "report":
        review_result = call_tool("review_all", {"project_path": pp, "language": lang})
        return _build_report(pp, review_result)
    return {"status": "error", "error": f"unknown tool: {tool_name}"}


class MCPHandler(http.server.BaseHTTPRequestHandler):
    def _json(self, code: int, body: dict):
        data = json.dumps({"jsonrpc": "2.0", **body}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._json(204, {"result": None})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"status": "ok", "version": "3.3.1", "mode": "local"})
        elif parsed.path == "/api/tools":
            tools_list = [{"name": n, "description": s["description"]} for n, s in TOOLS.items()]
            self._json(200, {"tools": tools_list})
        elif parsed.path == "/api/languages":
            self._json(200, {"languages": ["solidity", "js-ts", "python", "shell", "all"]})
        elif parsed.path == "/mcp":
            self._json(405, {"error": "use POST for MCP"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        parsed = urllib.parse.urlparse(self.path)

        # --- REST API routes (non-MCP) ---
        if parsed.path == "/api/review":
            if not body:
                self._json(400, {"error": "body required"})
                return
            tool_name = body.get("tool", "review_all")
            args = {
                "project_path": body.get("project_path", ""),
                "language": body.get("language", "all")
            }
            result = call_tool(tool_name, args)
            self._json(200 if result.get("status") == "ok" else 400, result)
            return

        if parsed.path == "/api/report":
            if not body or not body.get("project_path"):
                self._json(400, {"error": "project_path required"})
                return
            args = {
                "project_path": body["project_path"],
                "language": body.get("language", "all")
            }
            result = call_tool("review_all", args)
            report = _build_report(body["project_path"], result)
            self._json(200, report)
            return

        # --- MCP JSON-RPC routes ---
        if parsed.path != "/mcp":
            self._json(404, {"error": "not found"})
            return

        method = body.get("method", "")
        msg_id = body.get("id")

        if method == "initialize":
            self._json(200, {
                "id": msg_id,
                "result": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "code-review-mcp", "version": "3.3.1"}
                }
            })
        elif method == "tools/list":
            tools_list = [{"name": n, "description": s["description"], "inputSchema": s["parameters"]} for n, s in TOOLS.items()]
            self._json(200, {"id": msg_id, "result": {"tools": tools_list}})
        elif method == "tools/call":
            tool_name = body["params"]["name"]
            args = body["params"].get("arguments", {})
            result = call_tool(tool_name, args)
            self._json(200, {"id": msg_id, "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}})
        elif method == "notifications/initialized":
            self._json(200, {"id": msg_id, "result": {}})
        else:
            self._json(400, {"id": msg_id, "error": {"code": -32601, "message": f"unknown method: {method}"}})


def _build_report(project_path, review_result):
    """Build aggregated report from review_all raw results."""
    results = review_result.get("results", {})
    breakdown = {}
    total_p0 = 0
    total_p1 = 0
    total_p2 = 0
    top_issues = []

    for tool_name in ["lint", "format", "types", "complexity", "deps"]:
        r = results.get(tool_name, {})
        p0 = r.get("p0_count", 0) if isinstance(r, dict) else 0
        p1 = r.get("p1_count", 0) if isinstance(r, dict) else 0
        total = p0 + p1
        # score: start at 100, -5 per P0, -2 per P1, min 0
        score = max(0, 100 - p0 * 5 - p1 * 2)
        breakdown[tool_name] = {"score": score, "p0": p0, "p1": p1, "status": "fail" if p0 > 0 else ("warn" if p1 > 0 else "pass")}
        total_p0 += p0
        total_p1 += p1

        # collect top issues
        issues = r.get("issues", r.get("results", [])) if isinstance(r, dict) else []
        for issue in issues:
            sev = issue.get("severity", "").upper() if isinstance(issue, dict) else ""
            ok = issue.get("ok", True) if isinstance(issue, dict) else True
            if sev in ("P0", "P1", "ERROR") and not (ok and sev == "P0"):
                top_issues.append({
                    "tool": tool_name,
                    "severity": sev,
                    "file": issue.get("file", "") if isinstance(issue, dict) else "",
                    "line": issue.get("line", "") if isinstance(issue, dict) else "",
                    "message": issue.get("message", str(issue)) if isinstance(issue, dict) else str(issue)
                })

    # overall score: weighted average
    weights = {"lint": 0.3, "format": 0.15, "types": 0.3, "complexity": 0.1, "deps": 0.15}
    overall = sum(breakdown[k]["score"] * weights[k] for k in weights)

    if total_p0 > 0:
        status = "fail"
        summary = f"{total_p0}P0, {total_p1}P1 — BLOCKED. Fix P0 before review."
    elif total_p1 > 0:
        status = "warn"
        summary = f"{total_p0}P0, {total_p1}P1 — ready for L1 review with {total_p1} warnings"
    else:
        status = "pass"
        summary = "Clean. No issues detected. Ready for L1-L3 review."

    top_issues.sort(key=lambda x: ({"P0": 0, "P1": 1, "ERROR": 2}.get(x["severity"], 3)))

    return {
        "status": "ok",
        "report": {
            "project": project_path,
            "score": round(overall, 1),
            "status": status,
            "summary": summary,
            "p0_total": total_p0,
            "p1_total": total_p1,
            "breakdown": breakdown,
            "top_issues": top_issues[:15]
        }
    }


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9001
    if not os.path.isdir(REPOS_ROOT):
        log.warning(f"Repos root {REPOS_ROOT} does not exist — will be created by code-mgmt MCP")
    server = http.server.HTTPServer(("0.0.0.0", port), MCPHandler)
    log.info(f"Code Review MCP Server v3.1 (local mode, whitelist: {REPOS_ROOT}) on 0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
