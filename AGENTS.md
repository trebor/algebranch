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
- **Squash and Merge**: Always use the **Squash and Merge** strategy when merging feature branches into `main` to maintain a clean, linear commit history.
- **Pre-Merge Validation**: Before merging any branch, run the full validation gate — **lint → type-check → test → build**. The lint, type-check, and test commands are defined in [rules.md](rules.md) under **Validation Commands** (the single source of truth — do not restate them here); the build step is `npm run build` (compiles `math-engine`, then `ui`).

**Commit & approval lifecycle** — never skip a step without explicit user authorization:
1. Write the changes, run the validation gate, and confirm it passes.
2. **Halt.** Summarize the changes and point the user to the modified files for review/verification — do **not** commit speculatively.
3. Commit only after the user explicitly approves.
4. Never `git push`, `gh pr merge`, or merge directly without approval. Once commits are approved, offer to finalize: open/merge the PR, delete the feature branch, and clean up.

## Two-agent coordination

When alternating between **Claude Code and Antigravity** on this repo, follow [orchestration.md](orchestration.md) — the coordination doctrine (routing, quota policy, restart triggers, hand-off schema, resync-on-return). Keep the live hand-off in `BATON.md` (git-ignored, status/transport only). Task state still lives in GitHub Issues; the baton never holds plans or checklists.

## Styling guardrails

- **Use semantic styling tokens**: Do not hardcode raw Tailwind color classes (e.g. `bg-indigo-600`, `text-amber-400`, `text-white/40`, etc.) in TSX files. Instead, add/use centralized styling constants inside the `THEME_GLASS` object in [theme.ts](ui/src/constants/theme.ts).
