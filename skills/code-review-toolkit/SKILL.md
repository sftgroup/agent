---
name: code-review-toolkit
description: "Code quality review — lint, format, complexity, dead code, deps audit across JS/TS/Solidity/Python/Shell."
---

# Code Review Toolkit

Automated code quality review. No security scanning — that belongs to security-check. Focus: lint, format, complexity, dead code, dependency health.

## Tool Matrix

| Layer | JS/TS | Solidity | Python | Shell |
|-------|-------|----------|--------|-------|
| Lint | ESLint | Solhint | Ruff | ShellCheck |
| Format | Prettier | forge fmt | Black | shfmt |
| Types | tsc --noEmit | — | mypy | — |
| Complexity | eslint rules | — | radon | — |
| Dead code | eslint no-unused | solhint | ruff F401 | shellcheck SC2034 |
| Deps | npm audit | — | pip-audit | — |

## Workflow

1. Detect languages in project.
2. Install missing linters (`scripts/install-linters.sh`).
3. Run applicable checks per language (`scripts/run-all.sh`).
4. Collect results into structured report.
5. Rate each finding: P0 (must fix), P1 (should fix), P2 (nice to have).

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/install-linters.sh` | Install all linters (idempotent) |
| `scripts/run-all.sh` | Run full suite, output JSON + Markdown |
| `scripts/lint-solidity.sh` | Solhint config + run |
| `scripts/lint-typescript.sh` | ESLint + tsc + Prettier check |

## References

| File | Content |
|------|---------|
| `references/.solhint.json` | Baseline Solhint config |
| `references/.eslintrc.json` | Baseline ESLint config |
| `references/report-template.md` | Report output template |
