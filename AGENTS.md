# Agent Instructions — Algebranch

Shared instructions for all coding agents (Claude Code, Antigravity, etc.) working in this repo. `CLAUDE.md` imports this file — keep it tool-agnostic.

## Shared Agent Workbench (`.workbench/`)

Cross-tool planning and handoff state lives in `.workbench/`. All agents read and write it. Do **not** store project plans in tool-private locations (Antigravity brain/conversation dirs, Claude memory) — anything the next session or the other tool needs goes in `.workbench/`.

Protocol:

1. **Before starting work**: read `.workbench/INDEX.md`, then any `status: active` doc relevant to your task.
2. **Write plans and handoff state** to `.workbench/plans/` (one doc per effort: design, current state, next steps) and small decisions/discussions to `.workbench/notes/`. Update the relevant doc before the session ends so the next agent can resume cold.
3. **Every doc** starts with a short header: `status: active | done`, related GitHub issue, last-updated date (absolute, e.g. 2026-06-11).
4. **On completion**: set `status: done`, move the doc to `.workbench/archive/`, and update `INDEX.md`.
5. **Keep `INDEX.md` current**: one line per doc — link, status, one-line hook. It is the entry point; never let it drift.

## Source of truth

- **What to do, priority, status**: GitHub Issues + the GitHub Project. Use `gh issue list` to see current work.
- **How, design rationale, where-I-left-off**: `.workbench/` docs.
- Do **not** create roadmap/checklist markdown files elsewhere in the repo (the old `TASKS.md` was removed for exactly this reason). Treat any stray checklist file as archival, not live.

## Development guardrails

Branch/merge and commit protocol lives in `rules.md` (symlinked). Key points: run `npm test` and `npm run build` before any merge; never commit, push, or merge without explicit user approval — write changes, verify they compile/pass tests, then halt for user validation.

## Styling guardrails

- **Use semantic styling tokens**: Do not hardcode raw Tailwind color classes (e.g. `bg-indigo-600`, `text-amber-400`, `text-white/40`, etc.) in TSX files. Instead, add/use centralized styling constants inside the `THEME_GLASS` object in [theme.ts](file:///Users/trebor/src/algebranch/ui/src/constants/theme.ts).
