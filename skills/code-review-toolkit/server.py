#!/usr/bin/env python3
"""
Agent Review MCP Server — SSH proxy mode
Deploy on central MCP server (43.156.46.187). All OpenClaw instances call via HTTP.
MCP server SSH-es to target machine to run linters locally.

Tools:
  - review_lint(host, project_path, language)
  - review_format(host, project_path, language)
  - review_types(host, project_path, language)
  - review_complexity(host, project_path)
  - review_deps(host, project_path)
  - review_all(host, project_path, language)

Architecture:
  teamN ──tool call──→ MCP server ──SSH──→ target machine ──run linter──→ return result
"""

import json
import subprocess
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
log = logging.getLogger("agent-review-mcp")

SSH_USER = "ubuntu"
SSH_PASS = "Asdf1234!"


def ssh_exec(host: str, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    """Execute command on target host via SSH."""
    ssh_cmd = [
        "sshpass", "-p", SSH_PASS,
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        f"{SSH_USER}@{host}",
        cmd
    ]
    proc = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=timeout)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def remote_lint(host: str, project_path: str, language: str) -> dict:
    """Run lint on target host via SSH."""
    results = []

    if language in ("solidity", "all"):
        cmd = f'cd {project_path} && sol_files=$(find . -name "*.sol" -not -path "*/node_modules/*" -not -path "*/lib/*" -not -path "*/.git/*" 2>/dev/null) && if [ -n "$sol_files" ]; then solhint $sol_files 2>&1; fi'
        rc, out, err = ssh_exec(host, cmd)
        for line in (out + "\n" + err).split("\n"):
            line = line.strip()
            if line and ("error" in line.lower() or "warning" in line.lower() or ":" in line[:20]):
                results.append({"tool": "solhint", "host": host, "file": "", "line": 0, "message": line, "severity": "P1"})

        # forge fmt
        code, out, err = ssh_exec(host, f"cd {project_path} && forge fmt --check 2>&1", timeout=30)
        if code != 0:
            results.append({"tool": "forge fmt", "host": host, "file": "", "line": 0, "message": (out or "format issues found")[:500], "severity": "P1"})

    if language in ("js-ts", "all"):
        find_cmd = f'cd {project_path} && find . \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.git/*" 2>/dev/null'
        rc, files, _ = ssh_exec(host, find_cmd)
        if files:
            # eslint
            code, out, err = ssh_exec(host, f"cd {project_path} && npx eslint --format compact {files} 2>&1", timeout=120)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line:
                    results.append({"tool": "eslint", "host": host, "file": "", "line": 0, "message": line, "severity": "P1"})

    if language in ("python", "all"):
        find_cmd = f'cd {project_path} && find . -name "*.py" -not -path "*/.venv/*" -not -path "*/venv/*" -not -path "*/__pycache__/*" -not -path "*/.git/*" 2>/dev/null'
        rc, files, _ = ssh_exec(host, find_cmd)
        if files:
            code, out, err = ssh_exec(host, f"cd {project_path} && ruff check {files} 2>&1", timeout=60)
            for line in (out + "\n" + err).split("\n"):
                line = line.strip()
                if line:
                    results.append({"tool": "ruff", "host": host, "file": "", "line": 0, "message": line, "severity": "P1"})

    return {"host": host, "project": project_path, "language": language, "issueCount": len(results), "issues": results}


def remote_format(host: str, project_path: str, language: str) -> dict:
    result = {}
    if language in ("solidity", "all"):
        code, out, err = ssh_exec(host, f"cd {project_path} && forge fmt --check 2>&1", timeout=30)
        result["solidity"] = {"ok": code == 0, "output": (out + err)[:500]}
    if language in ("js-ts", "all"):
        code, out, err = ssh_exec(host, f"cd {project_path} && npx prettier --check '**/*.{{ts,tsx,js,jsx}}' 2>&1", timeout=60)
        result["js-ts"] = {"ok": code == 0, "output": (out + err)[:500]}
    if language in ("python", "all"):
        code, out, err = ssh_exec(host, f"cd {project_path} && find . -name '*.py' -not -path '*/.venv/*' | xargs black --check --diff 2>&1", timeout=60)
        result["python"] = {"ok": code == 0, "output": (out + err)[:500]}
    return result


def remote_types(host: str, project_path: str, language: str) -> dict:
    result = {}
    if language in ("js-ts", "all"):
        code, out, err = ssh_exec(host, f"cd {project_path} && npx tsc --noEmit 2>&1", timeout=60)
        result["js-ts"] = {"ok": code == 0, "errors": (out + err)[:1000]}
    if language in ("python", "all"):
        code, out, err = ssh_exec(host, f"cd {project_path} && find . -name '*.py' -not -path '*/.venv/*' | xargs mypy 2>&1", timeout=60)
        result["python"] = {"ok": code == 0, "errors": (out + err)[:1000]}
    return result


def remote_complexity(host: str, project_path: str) -> dict:
    result = {}
    code, out, err = ssh_exec(host, f"cd {project_path} && find . -name '*.py' -not -path '*/.venv/*' | xargs radon cc -a -s 2>&1", timeout=60)
    if out:
        complexity = []
        for line in out.split("\n"):
            parts = line.strip().split()
            if len(parts) >= 3 and parts[-1].startswith(('F', 'C', 'M')):
                complexity.append({"function": parts[0], "complexity": parts[-2], "rank": parts[-1]})
        result["python"] = complexity

    code, out, err = ssh_exec(host, f"cd {project_path} && npx eslint '**/*.{{ts,tsx}}' --rule 'complexity: [warn, 10]' --rule 'max-lines-per-function: [warn, {{max: 80}}]' --format compact 2>&1", timeout=60)
    if out:
        result["typescript"] = [l.strip() for l in out.split("\n") if l.strip() and "complexity" in l.lower()]
    return result


def remote_deps(host: str, project_path: str) -> dict:
    result = {}
    code, out, err = ssh_exec(host, f"cd {project_path} && npm audit --json 2>&1", timeout=120)
    if out and out.startswith("{"):
        try:
            data = json.loads(out)
            result["npm"] = data.get("metadata", {}).get("vulnerabilities", {})
        except json.JSONDecodeError:
            result["npm"] = {"raw": out[:500]}

    code, out, err = ssh_exec(host, f"cd {project_path} && find . -name 'requirements*.txt' -not -path '*/.venv/*' | head -1 | xargs -I{{}} pip-audit -r {{}} --format json 2>&1", timeout=120)
    if out and out.startswith("["):
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
        "description": "Run lint checks on target host via SSH (solidity/js-ts/python).",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string", "description": "Target host IP"},
                "project_path": {"type": "string", "description": "Absolute project path on target host"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["host", "project_path", "language"]
        }
    },
    "review_format": {
        "description": "Check code formatting on target host (forge fmt/prettier/black).",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["host", "project_path", "language"]
        }
    },
    "review_types": {
        "description": "Run type checks on target host (tsc/mypy).",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["js-ts", "python", "all"]}
            },
            "required": ["host", "project_path", "language"]
        }
    },
    "review_complexity": {
        "description": "Analyze code complexity on target host (radon/eslint).",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "project_path": {"type": "string"}
            },
            "required": ["host", "project_path"]
        }
    },
    "review_deps": {
        "description": "Audit dependencies on target host (npm audit/pip-audit).",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "project_path": {"type": "string"}
            },
            "required": ["host", "project_path"]
        }
    },
    "review_all": {
        "description": "Full code review on target host: lint + format + types + complexity + deps.",
        "parameters": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "project_path": {"type": "string"},
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]}
            },
            "required": ["host", "project_path", "language"]
        }
    }
}


def call_tool(tool_name: str, args: dict) -> dict:
    host = args["host"]
    pp = args["project_path"]
    lang = args.get("language", "all")

    if tool_name == "review_lint":
        return remote_lint(host, pp, lang)
    elif tool_name == "review_format":
        return remote_format(host, pp, lang)
    elif tool_name == "review_types":
        return remote_types(host, pp, lang)
    elif tool_name == "review_complexity":
        return remote_complexity(host, pp)
    elif tool_name == "review_deps":
        return remote_deps(host, pp)
    elif tool_name == "review_all":
        return {
            "host": host,
            "project": pp,
            "lint": remote_lint(host, pp, lang),
            "format": remote_format(host, pp, lang),
            "types": remote_types(host, pp, lang),
            "complexity": remote_complexity(host, pp),
            "deps": remote_deps(host, pp),
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
            self._json(200, {"status": "ok", "version": "2.0.0", "mode": "ssh-proxy"})
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
                    "serverInfo": {"name": "agent-review-mcp", "version": "2.0.0"}
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
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9020
    server = http.server.HTTPServer(("0.0.0.0", port), MCPHandler)
    log.info(f"Agent Review MCP Server (v2.0, SSH proxy) listening on 0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
