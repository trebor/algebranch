# Agent Instructions — Algebranch

Shared instructions for all coding agents (Claude Code, Antigravity, etc.) working in this repo. `CLAUDE.md` imports this file — keep it tool-agnostic.

## Source of truth

- **What to do, priority, status, and plans**: GitHub Issues + the **Algebranch Project board** (Project 6, https://github.com/users/trebor/projects/6/views/2). 
- **Board Status Columns**:
  - `Inbox`: Raw ideas, bugs, and incoming feature requests.
  - `Planning`: Design phase. Ambiguities, mathematical scoping, or UX choices are being discussed/drafted in the comments or issue description.
  - `Planned`: The implementation plan and checkboxes are finalized in the issue body. Ready to code.
  - `In progress`: Active development.
  - `Done`: Merged and closed.
- **Board hygiene (keep columns honest)**: The board is the human's at-a-glance status — move an item the moment its real status changes, not retroactively. On picking up an `Inbox` item to scope it, move it to `Planning`; when the plan + checkboxes are finalized in the issue body, move it to `Planned`; on starting code, move it to `In progress`; on merge+close, `Done`. Before any handoff or shutdown, verify every item you touched sits in the column that matches reality. Move with `gh project item-edit` (project `PVT_kwHOAMNZWs4BaYSq`, Status field `PVTSSF_lAHOAMNZWs4BaYSqzhVQUn0`; option ids — Inbox `f75ad846`, Planning `70e62ae5`, Planned `61e4505c`, In progress `47fc9ee4`, Done `98236657`).
- **Picking work**: Pick next work by priority, highest first, among `Planned` items. Read the board status with:

  ```sh
  gh project item-list 6 --owner trebor --format json --limit 50 \
    | jq -r '.items[] | [(.content.number//"-"), (.status//"-"), (.priority//"-"), (.content.title//.title)] | @tsv' \
    | sort -k3
  ```

  `gh issue list` shows the same issues without the priority/status ordering.
- **How, design rationale, where-I-left-off**: Linked/written in the active GitHub issue. 
  - On startup: Read the plan using `gh issue view <issue_number>`.
  - On shutdown/handoff: Update the issue description or post a comment with completed steps, details, and next tasks so the next agent can resume cold.
- Do **not** create roadmap, checklist, or plan files in the codebase.

## Development guardrails

This section is the **canonical commit/merge protocol** for every agent in this repo. Tool entry files (e.g. `CLAUDE.md`) reference it — they must not restate or override it.

**Branch & merge**
- **Branch BEFORE any work (mandatory, no exceptions)**: Never edit repo files while on `main`/`master`. The *first* action when picking up any task — before the first edit — is to create a feature branch: `git checkout -b <type>/<short-description>` (e.g. `feat/…`, `fix/…`, `chore/…`). Working on `main` and branching "later" is not allowed; if you ever find uncommitted work sitting on `main`, move it onto a branch immediately (`git checkout -b <branch>` carries the working tree over with no commit). For Claude Code this is hard-enforced by a `PreToolUse` hook (`.claude/hooks/block-edits-on-protected-branch.sh`, wired in `.claude/settings.json`) that blocks Edit/Write/NotebookEdit on a protected branch; **every** agent — including Antigravity, which the hook can't police — must follow the rule regardless.
- **Squash and Merge**: Always use the **Squash and Merge** strategy when merging feature branches into `main` to maintain a clean, linear commit history.
- **Pre-Merge Validation**: Before merging any branch, run the full validation gate — **lint → type-check → test → build**. The lint, type-check, and test commands are defined in [rules.md](rules.md) under **Validation Commands** (the single source of truth — do not restate them here); the build step is `npm run build` (compiles `math-engine`, then `ui`).

**Commit & approval lifecycle** — never skip a step without explicit user authorization:
1. Write the changes, run the validation gate, and confirm it passes.
2. **Halt.** Summarize the changes, point the user to the modified files for review/verification, and provide **specific local test URLs** (e.g., `http://localhost:3000/?eq=<test-expression>`) with detailed guidance on what to interact with, what test inputs/operators to click, and what exact visual or logical behavior to verify. Do **not** commit speculatively.
3. Commit only after the user explicitly approves.
4. Never `git push`, `gh pr merge`, or merge directly without approval. Once commits are approved, offer to finalize: open/merge the PR, delete the feature branch, and clean up.

## Local dev server

**The human owns the local dev server** (`npm run dev`, http://localhost:3000) — they start, stop, and restart it. Agents must **not** launch it or poll it (no background `npm run dev`, no health-check curl loops); that wastes tokens on something the human does instantly, and avoids two agents fighting over the port.

When a change needs verifying in the running app, **tell the human what to run and whether a restart is required**:
- **UI changes** (anything under `ui/src` — components, store, theme): Next dev hot-reloads. **No restart.**
- **`math-engine` changes**: require `npm run build` (rebuilds the `math-engine` dist the UI imports) **and** a dev-server restart to pick up the new bundle. **Flag this explicitly.**

Agents can still hand the user `?eq=<equation>` test URLs without the server running. Only start the server yourself if the human explicitly asks.

## Two-agent coordination

When alternating between **Claude Code and Antigravity** on this repo, follow [orchestration.md](orchestration.md) — the coordination doctrine (routing, quota policy, restart triggers, hand-off schema, resync-on-return). Keep the live hand-off in `BATON.md` (git-ignored, status/transport only). Task state still lives in GitHub Issues; the baton never holds plans or checklists.

## Styling guardrails

- **Use semantic styling tokens**: Do not hardcode raw Tailwind color classes (e.g. `bg-indigo-600`, `text-amber-400`, `text-white/40`, etc.) in TSX files. Instead, add/use centralized styling constants inside the `THEME_GLASS` object in [theme.ts](ui/src/constants/theme.ts).
