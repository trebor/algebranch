#!/usr/bin/env bash
# PreToolUse hook (Edit|Write|NotebookEdit): enforce the AGENTS.md "branch before
# any work" policy by blocking *committable* edits to repo files while on main/master.
# Left alone: files outside this repo (e.g. ~/.claude memory) and git-ignored files
# (BATON.md, .relay/, settings.local.json) — those are never committed, so editing
# them on main isn't "work on main" and the coordination protocol updates them there.
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
    "$repo_root"/*) ;;                                            # inside repo -> keep checking
    *) exit 0 ;;                                                  # outside repo -> allow
  esac
  if git check-ignore -q "$file_path" 2>/dev/null; then
    exit 0                                                        # git-ignored -> never committable -> allow
  fi
fi

cat >&2 <<EOF
BLOCKED by branch-first policy: you are on protected branch '$branch'.
Per AGENTS.md, create a feature branch BEFORE editing repo files:
  git checkout -b <type>/<short-description>
Then re-apply this edit.
EOF
exit 2
