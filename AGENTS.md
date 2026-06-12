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

Branch/merge and commit protocol lives in `rules.md` (symlinked). Key points: run `npm test` and `npm run build` before any merge; never commit, push, or merge without explicit user approval — write changes, verify they compile/pass tests, then halt for user validation.

## Styling guardrails

- **Use semantic styling tokens**: Do not hardcode raw Tailwind color classes (e.g. `bg-indigo-600`, `text-amber-400`, `text-white/40`, etc.) in TSX files. Instead, add/use centralized styling constants inside the `THEME_GLASS` object in [theme.ts](file:///Users/trebor/src/algebranch/ui/src/constants/theme.ts).
