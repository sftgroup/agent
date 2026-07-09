#!/usr/bin/env python3
"""
Code Review MCP Server — HTTP (Streamable HTTP)
Deploy on central server. All OpenClaw instances call this via MCP tool.

Tools:
  - review_lint(language, project_path)     → lint results per language
  - review_format(language, project_path)   → format check results
  - review_types(language, project_path)    → type check results
  - review_complexity(language, project_path) → complexity report
  - review_deps(project_path)               → dependency audit
  - review_all(language, project_path)      → full suite
"""

import json
import subprocess
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
log = logging.getLogger("code-review-mcp")

# --- Tool Implementations ---

def find_files(project_path: str, extensions: list[str]) -> list[str]:
    """Find files with given extensions in project, excluding deps."""
    files = []
    exclude_dirs = {'node_modules', 'lib', 'dist', 'build', '.git', 'venv', '.venv', '__pycache__', 'forge-std', 'openzeppelin'}
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in filenames:
            if any(f.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, f))
    return files


def lint_solidity(project_path: str) -> dict:
    files = find_files(project_path, ['.sol'])
    if not files:
        return {"found": False, "issues": []}

    # solhint
    cfg = Path(__file__).parent / "configs" / ".solhint.json"
    results = []
    if cfg.exists():
        try:
            proc = subprocess.run(
                ["solhint"] + files,
                capture_output=True, text=True, timeout=60,
                env={**os.environ, "PATH": os.environ.get("PATH", "")}
            )
            for line in proc.stdout.strip().split("\n"):
                if line.strip():
                    results.append({"tool": "solhint", "file": "", "line": 0, "message": line, "severity": "P1"})
        except FileNotFoundError:
            results.append({"tool": "solhint", "file": "", "line": 0, "message": "solhint not installed", "severity": "P2"})
    else:
        results.append({"tool": "solhint", "file": "", "line": 0, "message": "no config", "severity": "P2"})

    # forge fmt
    try:
        proc = subprocess.run(
            ["forge", "fmt", "--check"], cwd=project_path,
            capture_output=True, text=True, timeout=30
        )
        if proc.returncode != 0:
            results.append({"tool": "forge fmt", "file": "", "line": 0, "message": proc.stdout.strip() or "format issues found", "severity": "P1"})
    except FileNotFoundError:
        results.append({"tool": "forge fmt", "file": "", "line": 0, "message": "forge not installed", "severity": "P2"})

    return {"found": True, "fileCount": len(files), "issues": results}


def lint_typescript(project_path: str) -> dict:
    extensions = ['.ts', '.tsx', '.js', '.jsx']
    files = find_files(project_path, extensions)
    if not files:
        return {"found": False, "issues": []}

    results = []

    # eslint
    cfg = Path(__file__).parent / "configs" / ".eslintrc.json"
    try:
        cmd = ["eslint", "--format", "compact"] + files
        subprocess.run(["eslint", "--version"], capture_output=True, timeout=5)
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        for line in proc.stdout.strip().split("\n"):
            if line.strip():
                results.append({"tool": "eslint", "file": "", "line": 0, "message": line, "severity": "P1"})
    except (FileNotFoundError, subprocess.TimeoutExpired):
        results.append({"tool": "eslint", "file": "", "line": 0, "message": "eslint not available", "severity": "P2"})

    # tsc --noEmit
    tsconfig = os.path.join(project_path, "tsconfig.json")
    if os.path.exists(tsconfig):
        try:
            proc = subprocess.run(
                ["npx", "tsc", "--noEmit"], cwd=project_path,
                capture_output=True, text=True, timeout=60
            )
            if proc.returncode != 0:
                for line in proc.stdout.split("\n") + proc.stderr.split("\n"):
                    line = line.strip()
                    if line and "error TS" in line:
                        results.append({"tool": "tsc", "file": "", "line": 0, "message": line, "severity": "P0"})
        except (FileNotFoundError, subprocess.TimeoutExpired):
            results.append({"tool": "tsc", "file": "", "line": 0, "message": "tsc not available", "severity": "P2"})

    # prettier
    try:
        proc = subprocess.run(
            ["npx", "prettier", "--check"] + files, cwd=project_path,
            capture_output=True, text=True, timeout=60
        )
        if proc.returncode != 0:
            bad = [l.strip() for l in proc.stderr.split("\n") if l.strip()]
            results.append({"tool": "prettier", "file": "", "line": 0, "message": "\n".join(bad[:10]), "severity": "P1"})
    except (FileNotFoundError, subprocess.TimeoutExpired):
        results.append({"tool": "prettier", "file": "", "line": 0, "message": "prettier not available", "severity": "P2"})

    return {"found": True, "fileCount": len(files), "issues": results}


def lint_python(project_path: str) -> dict:
    files = find_files(project_path, ['.py'])
    if not files:
        return {"found": False, "issues": []}

    results = []

    # ruff
    try:
        proc = subprocess.run(
            ["ruff", "check"] + files, capture_output=True, text=True, timeout=60
        )
        for line in proc.stdout.strip().split("\n"):
            if line.strip():
                results.append({"tool": "ruff", "file": "", "line": 0, "message": line, "severity": "P1"})
    except FileNotFoundError:
        results.append({"tool": "ruff", "file": "", "line": 0, "message": "ruff not installed", "severity": "P2"})

    # black check
    try:
        proc = subprocess.run(
            ["black", "--check", "--diff"] + files, capture_output=True, text=True, timeout=60
        )
        if proc.returncode != 0:
            results.append({"tool": "black", "file": "", "line": 0, "message": "format issues found", "severity": "P1"})
    except FileNotFoundError:
        results.append({"tool": "black", "file": "", "line": 0, "message": "black not installed", "severity": "P2"})

    # mypy
    try:
        proc = subprocess.run(
            ["mypy"] + files, capture_output=True, text=True, timeout=60
        )
        if proc.returncode != 0:
            for line in proc.stdout.strip().split("\n"):
                if line.strip():
                    results.append({"tool": "mypy", "file": "", "line": 0, "message": line, "severity": "P0"})
    except FileNotFoundError:
        results.append({"tool": "mypy", "file": "", "line": 0, "message": "mypy not installed", "severity": "P2"})

    return {"found": True, "fileCount": len(files), "issues": results}


def review_complexity(project_path: str) -> dict:
    results = {}
    py_files = find_files(project_path, ['.py'])
    if py_files:
        try:
            proc = subprocess.run(
                ["radon", "cc"] + py_files + ["-a", "-s"],
                capture_output=True, text=True, timeout=60
            )
            complexity = []
            for line in proc.stdout.strip().split("\n"):
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 3 and parts[-1].startswith(('F','C','M')):
                        complexity.append({"function": parts[0], "complexity": parts[-2], "rank": parts[-1]})
            results["python"] = complexity
        except FileNotFoundError:
            results["python"] = {"error": "radon not installed"}

    ts_files = find_files(project_path, ['.ts', '.tsx'])
    if ts_files:
        try:
            proc = subprocess.run(
                ["eslint"] + ts_files + ["--rule", "complexity: [warn, 10]", "--rule", "max-lines-per-function: [warn, {max: 80}]", "--format", "compact"],
                capture_output=True, text=True, timeout=60
            )
            results["typescript"] = [l.strip() for l in proc.stdout.split("\n") if l.strip() and "complexity" in l.lower()]
        except FileNotFoundError:
            results["typescript"] = {"error": "eslint not installed"}

    return results


def review_deps(project_path: str) -> dict:
    results = {}

    pkg_json = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_json):
        try:
            proc = subprocess.run(
                ["npm", "audit", "--json"], cwd=project_path,
                capture_output=True, text=True, timeout=120
            )
            if proc.returncode != 0:
                try:
                    data = json.loads(proc.stdout)
                    vuln = data.get("metadata", {}).get("vulnerabilities", {})
                    results["npm"] = vuln
                except json.JSONDecodeError:
                    results["npm"] = {"error": "failed to parse audit output"}
        except (FileNotFoundError, subprocess.TimeoutExpired):
            results["npm"] = {"error": "npm not available"}

    req_files = find_files(project_path, ['requirements.txt', 'requirements-dev.txt'])
    if req_files:
        try:
            proc = subprocess.run(
                ["pip-audit", "-r", req_files[0], "--format", "json"],
                capture_output=True, text=True, timeout=120
            )
            if proc.stdout.strip():
                try:
                    results["python"] = json.loads(proc.stdout)
                except json.JSONDecodeError:
                    results["python"] = json.loads(proc.stdout) if proc.stdout.strip().startswith('[') else {"raw": proc.stdout.strip()}
        except FileNotFoundError:
            results["python"] = {"error": "pip-audit not installed"}

    return results


# --- MCP HTTP Handler ---

import http.server
import urllib.parse

TOOLS = {
    "review_lint": {
        "description": "Run lint checks on a project (solidity/js-ts/python). Returns issues with severity.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]},
                "project_path": {"type": "string", "description": "Absolute path to project root on server"}
            },
            "required": ["language", "project_path"]
        }
    },
    "review_format": {
        "description": "Check code formatting (forge fmt/prettier/black). Returns files needing format.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]},
                "project_path": {"type": "string"}
            },
            "required": ["language", "project_path"]
        }
    },
    "review_types": {
        "description": "Run type checks (tsc/mypy). Returns type errors.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {"type": "string", "enum": ["js-ts", "python", "all"]},
                "project_path": {"type": "string"}
            },
            "required": ["language", "project_path"]
        }
    },
    "review_complexity": {
        "description": "Analyze code complexity (cyclomatic, function length). Returns ranked results.",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_deps": {
        "description": "Audit dependencies for vulnerabilities (npm audit, pip-audit).",
        "parameters": {
            "type": "object",
            "properties": {
                "project_path": {"type": "string"}
            },
            "required": ["project_path"]
        }
    },
    "review_all": {
        "description": "Run full code quality review: lint + format + types + complexity + deps.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {"type": "string", "enum": ["solidity", "js-ts", "python", "all"]},
                "project_path": {"type": "string"}
            },
            "required": ["language", "project_path"]
        }
    }
}


def call_tool(tool_name: str, args: dict) -> dict:
    lang = args.get("language", "all")
    pp = args["project_path"]

    if tool_name == "review_lint":
        result = {}
        if lang in ("solidity", "all"):
            result["solidity"] = lint_solidity(pp)
        if lang in ("js-ts", "all"):
            result["js-ts"] = lint_typescript(pp)
        if lang in ("python", "all"):
            result["python"] = lint_python(pp)
        return result

    elif tool_name == "review_format":
        result = {}
        if lang in ("solidity", "all"):
            try:
                proc = subprocess.run(["forge", "fmt", "--check"], cwd=pp, capture_output=True, text=True, timeout=30)
                result["solidity"] = {"ok": proc.returncode == 0, "output": proc.stdout.strip()[:500]}
            except FileNotFoundError:
                result["solidity"] = {"error": "forge not installed"}
        if lang in ("js-ts", "all"):
            try:
                proc = subprocess.run(["npx", "prettier", "--check", f"{pp}/**/*.{{ts,tsx,js,jsx}}"], capture_output=True, text=True, timeout=60)
                result["js-ts"] = {"ok": proc.returncode == 0, "output": proc.stdout.strip()[:500]}
            except FileNotFoundError:
                result["js-ts"] = {"error": "prettier not installed"}
        if lang in ("python", "all"):
            py_files = find_files(pp, ['.py'])
            if py_files:
                try:
                    proc = subprocess.run(["black", "--check"] + py_files, capture_output=True, text=True, timeout=60)
                    result["python"] = {"ok": proc.returncode == 0, "output": proc.stdout.strip()[:500]}
                except FileNotFoundError:
                    result["python"] = {"error": "black not installed"}
        return result

    elif tool_name == "review_types":
        result = {}
        if lang in ("js-ts", "all"):
            tsconfig = os.path.join(pp, "tsconfig.json")
            if os.path.exists(tsconfig):
                try:
                    proc = subprocess.run(["npx", "tsc", "--noEmit"], cwd=pp, capture_output=True, text=True, timeout=60)
                    result["js-ts"] = {"ok": proc.returncode == 0, "errors": proc.stdout.strip()[:1000]}
                except FileNotFoundError:
                    result["js-ts"] = {"error": "tsc not installed"}
        if lang in ("python", "all"):
            py_files = find_files(pp, ['.py'])
            if py_files:
                try:
                    proc = subprocess.run(["mypy"] + py_files, capture_output=True, text=True, timeout=60)
                    result["python"] = {"ok": proc.returncode == 0, "errors": proc.stdout.strip()[:1000]}
                except FileNotFoundError:
                    result["python"] = {"error": "mypy not installed"}
        return result

    elif tool_name == "review_complexity":
        return review_complexity(pp)

    elif tool_name == "review_deps":
        return review_deps(pp)

    elif tool_name == "review_all":
        lang = args.get("language", "all")
        return {
            "lint": call_tool("review_lint", {"language": lang, "project_path": pp}),
            "format": call_tool("review_format", {"language": lang, "project_path": pp}),
            "types": call_tool("review_types", {"language": lang, "project_path": pp}),
            "complexity": call_tool("review_complexity", {"project_path": pp}),
            "deps": call_tool("review_deps", {"project_path": pp}),
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
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"status": "ok", "version": "1.0.0"})
        elif parsed.path == "/mcp":
            # For SSE GET — not fully implemented, use POST
            self._json(405, {"error": "use POST for MCP"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/mcp":
            method = body.get("method", "")
            msg_id = body.get("id")

            if method == "initialize":
                self._json(200, {
                    "id": msg_id,
                    "result": {
                        "protocolVersion": "2025-06-18",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "code-review-mcp", "version": "1.0.0"}
                    }
                })
            elif method == "tools/list":
                tools_list = []
                for name, schema in TOOLS.items():
                    tools_list.append({"name": name, "description": schema["description"], "inputSchema": schema["parameters"]})
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
        else:
            self._json(404, {"error": "not found"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9020
    server = http.server.HTTPServer(("0.0.0.0", port), MCPHandler)
    log.info(f"Code Review MCP Server listening on 0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
