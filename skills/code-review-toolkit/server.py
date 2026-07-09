#!/usr/bin/env python3
"""
Code Review MCP Server v3.0 — local filesystem mode
Deploy on central MCP server (43.156.46.187).
All team code lives on this server (git-managed). Review runs locally.

Tools:
  - review_lint(project_path, language)     → lint results
  - review_format(project_path, language)   → format check
  - review_types(project_path, language)    → type check (tsc/mypy)
  - review_complexity(project_path)         → cyclomatic complexity
  - review_deps(project_path)               → npm audit / pip-audit
  - review_all(project_path, language)      → full suite

Architecture:
  teamN ──MCP tool call──→ MCP server ──run linter locally on /opt/mcp/repos/<team>/
"""

import json
import subprocess
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
log = logging.getLogger("code-review-mcp")


def find_files(project_path: str, extensions: list[str]) -> list[str]:
    files = []
    exclude_dirs = {'node_modules', 'lib', 'dist', 'build', '.git', 'venv', '.venv', '__pycache__', 'forge-std', 'openzeppelin'}
    if not os.path.isdir(project_path):
        return []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in filenames:
            if any(f.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, f))
    return files


def run(cmd: list[str], cwd: str = None, timeout: int = 120) -> tuple[int, str, str]:
    """Run command locally, return (code, stdout, stderr)."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError:
        return -1, "", "tool not found"
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"


# --- Review Functions ---

def review_lint(project_path: str, language: str) -> dict:
    results = []

    if language in ("solidity", "all"):
        sol_files = find_files(project_path, ['.sol'])
        if sol_files:
            rc, out, err = run(["solhint"] + sol_files)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line and (":" in line[:20] or "error" in line.lower() or "warning" in line.lower()):
                    results.append({"tool": "solhint", "file": line.split(":")[0] if ":" in line else "", "message": line, "severity": "P1"})

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

    return {"project": project_path, "language": language, "issueCount": len(results), "issues": results}


def review_format(project_path: str, language: str) -> dict:
    result = {}
    if language in ("solidity", "all"):
        rc, out, err = run(["forge", "fmt", "--check"], cwd=project_path, timeout=30)
        result["solidity"] = {"ok": rc == 0, "output": (out + err)[:500]}
    if language in ("js-ts", "all"):
        rc, out, err = run(["npx", "prettier", "--check", f"{project_path}/**/*.{{ts,tsx,js,jsx}}"], timeout=60)
        result["js-ts"] = {"ok": rc == 0, "output": (out + err)[:500]}
    if language in ("python", "all"):
        py_files = find_files(project_path, ['.py'])
        if py_files:
            rc, out, err = run(["black", "--check", "--diff"] + py_files, timeout=60)
            result["python"] = {"ok": rc == 0, "output": (out + err)[:500]}
    return result


def review_types(project_path: str, language: str) -> dict:
    result = {}
    if language in ("js-ts", "all"):
        tsconfig = os.path.join(project_path, "tsconfig.json")
        if os.path.exists(tsconfig):
            rc, out, err = run(["npx", "tsc", "--noEmit"], cwd=project_path, timeout=60)
            result["js-ts"] = {"ok": rc == 0, "errors": (out + err)[:1000]}
    if language in ("python", "all"):
        py_files = find_files(project_path, ['.py'])
        if py_files:
            rc, out, err = run(["mypy"] + py_files, timeout=60)
            result["python"] = {"ok": rc == 0, "errors": (out + err)[:1000]}
    return result


def review_complexity(project_path: str) -> dict:
    result = {}
    py_files = find_files(project_path, ['.py'])
    if py_files:
        rc, out, err = run(["radon", "cc"] + py_files + ["-a", "-s"], timeout=60)
        complexity = []
        for line in out.split("\n"):
            parts = line.strip().split()
            if len(parts) >= 3 and parts[-1].startswith(('F', 'C', 'M')):
                complexity.append({"function": parts[0], "complexity": parts[-2], "rank": parts[-1]})
        result["python"] = complexity

    ts_files = find_files(project_path, ['.ts', '.tsx'])
    if ts_files:
        rc, out, err = run(["eslint"] + ts_files + ["--rule", "complexity: [warn, 10]", "--rule", "max-lines-per-function: [warn, {max: 80}]", "--format", "compact"], timeout=60)
        result["typescript"] = [l.strip() for l in out.split("\n") if l.strip() and "complexity" in l.lower()]
    return result


def review_deps(project_path: str) -> dict:
    result = {}
    pkg_json = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_json):
        rc, out, err = run(["npm", "audit", "--json"], cwd=project_path, timeout=120)
        if out.startswith("{"):
            try:
                data = json.loads(out)
                result["npm"] = data.get("metadata", {}).get("vulnerabilities", {})
            except json.JSONDecodeError:
                result["npm"] = {"raw": out[:500]}

    req_files = find_files(project_path, ['requirements.txt'])
    if req_files:
        rc, out, err = run(["pip-audit", "-r", req_files[0], "--format", "json"], timeout=120)
        if out.startswith("[") or out.startswith("{"):
            try:
                result["python"] = json.loads(out)
            except json.JSONDecodeError:
                result["python"] = {"raw": out[:500]}
    return result


# --- MCP HTTP Handler ---

import http.server
import urllib.parse

TOOLS = {
    "review_lint": {
        "description": "Lint checks on central repo (solhint/eslint/ruff). Returns issues with severity.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string", "description": "Project path on MCP server, e.g. /opt/mcp/repos/team3"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "review_format": {
        "description": "Format check on central repo (forge fmt/prettier/black).",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["project_path", "language"]
        }
    },
    "review_types": {
        "description": "Type check on central repo (tsc/mypy).",
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
        "description": "Code complexity analysis on central repo (radon/eslint).",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_deps": {
        "description": "Dependency vulnerability audit on central repo (npm audit/pip-audit).",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_all": {
        "description": "Full code review: lint + format + types + complexity + deps.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["project_path", "language"]
        }
    }
}


def call_tool(tool_name: str, args: dict) -> dict:
    pp = args["project_path"]
    lang = args.get("language", "all")

    if not os.path.isdir(pp):
        return {"error": f"project not found: {pp}"}

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
            "project": pp,
            "language": lang,
            "lint": review_lint(pp, lang),
            "format": review_format(pp, lang),
            "types": review_types(pp, lang),
            "complexity": review_complexity(pp),
            "deps": review_deps(pp),
        }
    return {"error": f"unknown tool: {tool_name}"}


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
            self._json(200, {"status": "ok", "version": "3.0.0", "mode": "local"})
        elif parsed.path == "/mcp":
            self._json(405, {"error": "use POST for MCP"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        parsed = urllib.parse.urlparse(self.path)
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
                    "serverInfo": {"name": "code-review-mcp", "version": "3.0.0"}
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


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9001
    server = http.server.HTTPServer(("0.0.0.0", port), MCPHandler)
    log.info(f"Code Review MCP Server v3.0 (local mode) on 0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
