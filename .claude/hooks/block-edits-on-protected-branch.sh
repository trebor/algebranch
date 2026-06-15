#!/usr/bin/env bash
# PreToolUse hook (Edit|Write|NotebookEdit): enforce the AGENTS.md "branch before
# any work" policy by blocking edits to repo files while on main/master.
# Edits to files outside this repo (e.g. ~/.claude memory) are left alone.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0   # not a git repo -> allow
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

case "$branch" in
  main|master) ;;
  *) exit 0 ;;                                                     # feature branch -> allow
esac

if [ -n "$file_path" ]; then
  case "$file_path" in
    "$repo_root"/*) ;;                                            # inside repo -> block
    *) exit 0 ;;                                                  # outside repo -> allow
  esac
fi

cat >&2 <<EOF
BLOCKED by branch-first policy: you are on protected branch '$branch'.
Per AGENTS.md, create a feature branch BEFORE editing repo files:
  git checkout -b <type>/<short-description>
Then re-apply this edit.
EOF
exit 2
