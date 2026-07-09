#!/usr/bin/env bash
# Code Review Toolkit — run full suite
# Usage: bash run-all.sh <project-root>
# Output: test-reports/CODE_REVIEW_REPORT.md + test-reports/code-review.json
set -e

PROJECT="${1:-.}"
[ ! -d "$PROJECT" ] && echo "❌ Not a directory: $PROJECT" && exit 1

PROJECT=$(cd "$PROJECT" && pwd)
OUTDIR="$PROJECT/test-reports"
mkdir -p "$OUTDIR"
REPORT_MD="$OUTDIR/CODE_REVIEW_REPORT.md"
REPORT_JSON="$OUTDIR/code-review.json"
TIMESTAMP=$(date -Iseconds)
SELF_DIR=$(dirname "$0")

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$HOME/.nvm/versions/node/v22.23.0/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

echo "# Code Review Report — $PROJECT" > "$REPORT_MD"
echo "Generated: $TIMESTAMP" >> "$REPORT_MD"
echo "" >> "$REPORT_MD"

JSON_BUF='{"project":"'"$PROJECT"'","timestamp":"'"$TIMESTAMP"'","results":{'

# --- Solidity ---
if find "$PROJECT" -name '*.sol' ! -path '*/lib/*' ! -path '*/node_modules/*' | head -1 | grep -q sol; then
  echo "## Solidity" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # solhint
  echo "### solhint" >> "$REPORT_MD"
  if command -v solhint >/dev/null 2>&1; then
    CFG="$SELF_DIR/../references/.solhint.json"
    [ -f "$CFG" ] && cp "$CFG" "$PROJECT/.solhint.json"
    solhint "$PROJECT/contracts/src/**/*.sol" 2>&1 | tail -20 >> "$REPORT_MD" || echo "_solhint found issues_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  else
    echo "⚠️ solhint not installed" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi

  # forge fmt check
  echo "### forge fmt" >> "$REPORT_MD"
  if command -v forge >/dev/null 2>&1; then
    cd "$PROJECT"
    forge fmt --check 2>&1 | tail -10 >> "$REPORT_MD" || echo "_format issues found_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  else
    echo "⚠️ forge not available" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi
fi

# --- JS/TS ---
if find "$PROJECT" -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | head -1 | grep -qE '\.(ts|tsx|js|jsx)$'; then
  echo "## JavaScript / TypeScript" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # ESLint
  echo "### eslint" >> "$REPORT_MD"
  if command -v eslint >/dev/null 2>&1; then
    CFG="$SELF_DIR/../references/.eslintrc.json"
    [ -f "$CFG" ] && cp "$CFG" "$PROJECT/.eslintrc.json"
    eslint "$PROJECT" --ext .ts,.tsx,.js,.jsx --ignore-pattern node_modules --ignore-pattern dist --ignore-pattern build 2>&1 | tail -30 >> "$REPORT_MD" || echo "_eslint found issues_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  else
    echo "⚠️ eslint not installed" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi

  # TypeScript
  echo "### tsc --noEmit" >> "$REPORT_MD"
  if [ -f "$PROJECT/tsconfig.json" ] && command -v tsc >/dev/null 2>&1; then
    cd "$PROJECT"
    npx tsc --noEmit 2>&1 | tail -20 >> "$REPORT_MD" || echo "_type errors found_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  else
    echo "⚠️ no tsconfig.json or tsc not available" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi

  # Prettier check
  echo "### prettier" >> "$REPORT_MD"
  if command -v prettier >/dev/null 2>&1; then
    npx prettier --check "$PROJECT/**/*.{ts,tsx,js,jsx}" --ignore-path "$PROJECT/.gitignore" 2>/dev/null | tail -10 >> "$REPORT_MD" || echo "_format issues found_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  else
    echo "⚠️ prettier not installed" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi

  # Dead code (eslint no-unused-vars)
  echo "### dead code (eslint no-unused-vars)" >> "$REPORT_MD"
  if command -v eslint >/dev/null 2>&1; then
    eslint "$PROJECT" --ext .ts,.tsx,.js,.jsx --rule 'no-unused-vars: error' --ignore-pattern node_modules --ignore-pattern dist 2>&1 | grep -E 'is defined but never used|is assigned a value but never used' | head -20 >> "$REPORT_MD" || echo "_no dead code detected_" >> "$REPORT_MD"
    echo "" >> "$REPORT_MD"
  fi
fi

# --- Python ---
if find "$PROJECT" -name '*.py' ! -path '*/venv/*' ! -path '*/.venv/*' | head -1 | grep -q py; then
  echo "## Python" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # Ruff
  echo "### ruff" >> "$REPORT_MD"
  command -v ruff >/dev/null 2>&1 && {
    ruff check "$PROJECT" --exclude 'venv,.venv,__pycache__' 2>&1 | tail -20 >> "$REPORT_MD" || echo "_ruff found issues_" >> "$REPORT_MD"
  } || echo "⚠️ ruff not installed" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # Black check
  echo "### black" >> "$REPORT_MD"
  command -v black >/dev/null 2>&1 && {
    black --check --exclude 'venv|\.venv|__pycache__' "$PROJECT" 2>&1 | tail -10 >> "$REPORT_MD" || echo "_format issues found_" >> "$REPORT_MD"
  } || echo "⚠️ black not installed" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # mypy
  echo "### mypy" >> "$REPORT_MD"
  command -v mypy >/dev/null 2>&1 && {
    mypy "$PROJECT" --exclude 'venv|\.venv|__pycache__' 2>&1 | tail -20 >> "$REPORT_MD" || echo "_type errors found_" >> "$REPORT_MD"
  } || echo "⚠️ mypy not installed" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  # Radon complexity
  echo "### radon cc (cyclomatic complexity)" >> "$REPORT_MD"
  command -v radon >/dev/null 2>&1 && {
    radon cc "$PROJECT" --exclude 'venv,\.venv,__pycache__' -a 2>&1 | head -30 >> "$REPORT_MD" || echo "_no complexity issues_" >> "$REPORT_MD"
  } || echo "⚠️ radon not installed" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"
fi

# --- Shell ---
if find "$PROJECT" -name '*.sh' | head -1 | grep -q sh; then
  echo "## Shell" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"

  echo "### shellcheck" >> "$REPORT_MD"
  command -v shellcheck >/dev/null 2>&1 && {
    find "$PROJECT" -name '*.sh' -exec shellcheck {} \; 2>&1 | tail -20 >> "$REPORT_MD" || echo "_shellcheck found issues_" >> "$REPORT_MD"
  } || echo "⚠️ shellcheck not installed" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"
fi

# --- Dependency Audit ---
echo "## Dependency Audit" >> "$REPORT_MD"
echo "" >> "$REPORT_MD"

if [ -f "$PROJECT/package.json" ] && command -v npm >/dev/null 2>&1; then
  echo "### npm audit" >> "$REPORT_MD"
  cd "$PROJECT"
  npm audit --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
v=d.get('metadata',{}).get('vulnerabilities',{})
print(f\"  critical={v.get('critical',0)} high={v.get('high',0)} moderate={v.get('moderate',0)} low={v.get('low',0)}\")
" 2>/dev/null >> "$REPORT_MD" || echo "_npm audit failed or no vulns_" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"
fi

if find "$PROJECT" -name 'requirements*.txt' | head -1 | grep -q requirements && command -v pip-audit >/dev/null 2>&1; then
  echo "### pip-audit" >> "$REPORT_MD"
  pip-audit -r "$(find "$PROJECT" -name 'requirements*.txt' | head -1)" 2>&1 | tail -10 >> "$REPORT_MD" || echo "_pip-audit found issues_" >> "$REPORT_MD"
  echo "" >> "$REPORT_MD"
fi

# --- Summary ---
echo "## Summary" >> "$REPORT_MD"
echo "" >> "$REPORT_MD"
echo "Report generated at $TIMESTAMP" >> "$REPORT_MD"
echo "Full details above per-language sections." >> "$REPORT_MD"

echo "✅ Report written: $REPORT_MD"
