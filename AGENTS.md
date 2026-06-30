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
  gh project item-list 6 --owner trebor --format json --limit 500 \
    | jq -r '.items[] | [(.content.number//"-"), (.status//"-"), (.priority//"-"), (.content.title//.title)] | @tsv' \
    | sort -k3
  ```

  `gh issue list` shows the same issues without the priority/status ordering. **Always pass a large `--limit` (e.g. `--limit 500`) to `gh issue list` / `gh project item-list` when searching or enumerating** — both default to only 30 results and will silently truncate the ~100-issue backlog, so a search can "succeed" while missing real items.
- **Epics vs milestones**: An **epic** is a convention, not a GitHub feature — an ordinary issue titled `epic: …` whose body holds a markdown checklist of member issues (`- [ ] #179 — …`), grouping work by *theme* with ordering rationale (e.g. [#185]). A **milestone** is a native GitHub field grouping work by *shipping boundary* (e.g. the Public-release launch); an issue has at most one. The two axes are orthogonal — an issue can sit in an epic and a milestone both. **Keep epics as annotated markdown checklists; do not migrate them to GitHub's native sub-issues** — the per-line rationale (why a tranche is ordered where it is) is the point, and sub-issues can't hold it. Only consider native sub-issues if you ever need epic membership grouped/filtered *on the board itself* (which today we don't — we navigate by priority/status).
- **How, design rationale, where-I-left-off**: Linked/written in the active GitHub issue. 
  - On startup: Read the plan using `gh issue view <issue_number>`.
  - On shutdown/handoff: Update the issue description or post a comment with completed steps, details, and next tasks so the next agent can resume cold.
- Do **not** create roadmap, checklist, or plan files in the codebase.

## Clickable references (required)

In **messages to the human**, every reference to an issue, PR, milestone, the project board, or a commit **must** be a Markdown link, with the bare reference as the link text — so the terminal shows the short form (e.g. `#123`) while the full URL is one click away. Base URL: `https://github.com/trebor/algebranch`.

- **Issues / PRs**: `[#123](https://github.com/trebor/algebranch/issues/123)` — the `/issues/<n>` path resolves to PRs too, so it's safe when the type is unknown.
- **Commits**: `[2556c52](https://github.com/trebor/algebranch/commit/2556c52)` (short or full SHA).
- **Milestones**: `[Public release](https://github.com/trebor/algebranch/milestone/1)`.
- **Project board**: `[Algebranch board](https://github.com/users/trebor/projects/6/views/2)`.

This applies to prose addressed to the human. Commit messages, PR/issue bodies, and board text rely on GitHub's native `#123` autolinking — do **not** add Markdown links there.

## Development guardrails

This section is the **canonical commit/merge protocol** for every agent in this repo. Tool entry files (e.g. `CLAUDE.md`) reference it — they must not restate or override it.

**Branch & merge**
- **Branch BEFORE any work (mandatory, no exceptions)**: Never edit repo files while on `main`/`master`. The *first* action when picking up any task — before the first edit — is to create a feature branch: `git checkout -b <type>/<short-description>` (e.g. `feat/…`, `fix/…`, `chore/…`). Working on `main` and branching "later" is not allowed; if you ever find uncommitted work sitting on `main`, move it onto a branch immediately (`git checkout -b <branch>` carries the working tree over with no commit). For Claude Code this is hard-enforced by a `PreToolUse` hook (`.claude/hooks/block-edits-on-protected-branch.sh`, wired in `.claude/settings.json`) that blocks Edit/Write/NotebookEdit on a protected branch; **every** agent — including Antigravity, which the hook can't police — must follow the rule regardless.
- **Squash and Merge**: Always use the **Squash and Merge** strategy when merging feature branches into `main` to maintain a clean, linear commit history.
- **Pre-Merge Validation**: Before merging any branch, run the full validation gate — **lint → type-check → test → build**. The lint, type-check, and test commands are defined in [rules.md](rules.md) under **Validation Commands** (the single source of truth — do not restate them here); the build step is `npm run build` (compiles `math-engine`, then `ui`).

**Test-driven development (mandatory)** — write the test *before* the implementation, following red → green → refactor:
1. **Red**: For each new behavior or bug fix, first add a test that captures the desired behavior, run it, and confirm it **fails for the right reason** (asserting the new behavior, not erroring on a typo/missing import). A bug fix starts with a test that reproduces the bug.
2. **Green**: Write the minimum implementation to make that test pass; do not write production logic that isn't driven by a failing test.
3. **Refactor**: Clean up with the tests green.
- This applies to all `math-engine` logic and any testable `ui` logic (store, helpers, pure functions). For purely visual/interaction UI tweaks where a unit test genuinely can't lead, say so explicitly and fall back to the manual test-URL verification in the commit lifecycle below.
- Cover the real branches: the happy path, edge cases, and the null/no-op cases (when a transform should *not* fire). Prefer a failing test over a manual probe when scoping behavior.

**Commit & approval lifecycle** — never skip a step without explicit user authorization:
1. Write the changes test-first per the TDD cycle above, run the full validation gate, and confirm it passes.
2. **Halt.** Summarize the changes, point the user to the modified files for review/verification, and provide **specific local test URLs** (e.g., `http://localhost:3000/?eq=<test-expression>` for Claude or `http://localhost:3001/?eq=<test-expression>` for Gemini) with detailed guidance on what to interact with, what test inputs/operators to click, and what exact visual or logical behavior to verify. **Always URL-encode the equation** (everything after `?eq=`) so it survives the share-link round-trip **and stays fully clickable in the terminal**. `encodeURIComponent` covers the round-trip cases — `=`→`%3D`, `/`→`%2F`, `+`→`%2B`, `,`→`%2C` (form-decoding silently turns a raw `+` into a space, corrupting sums) — but it leaves `(`, `)`, `*` raw, and most CLIs drop a trailing `)` from the hyperlink (so the user can't click the whole URL). Encode those too: `(`→`%28`, `)`→`%29`, `*`→`%2A`. Do **not** commit speculatively.
3. Commit only after the user explicitly approves.
4. Never `git push`, `gh pr merge`, or merge directly without approval. Once commits are approved, offer to finalize: open/merge the PR, delete the feature branch, and clean up.

**Publishing to production ("Publish it")** — where "ship it" finishes a branch, **"Publish it"** is the trigger to cut a release and ship it live to https://algebranch.com. A few invariants always hold:
- **Publishing = promoting `main → production`** (Vercel deploys from `production`, not `main`). This is **gated**: never push or merge to `production` without explicit, per-release approval. A release does *not* require an associated milestone — milestones group a themed batch toward a shipping boundary (as the launch did), but routine releases don't need one; the recurring gate is the human's approval on the promotion.
- The monorepo carries a **single unified version**; root `package.json` is the source of truth, surfaced in-app via `next.config.ts` → `ui/src/constants/version.ts` (so **do not** hand-edit any version string in `ui/src`).
- The curated `CHANGELOG.md` section is the release notes / "what's new", mirrored into the GitHub release.

The mechanics of bumping the version, finalizing the changelog, tagging, and cutting the GitHub release are moving to commit-driven automation (release-please) — see #337. Until that lands, perform those steps by hand following the invariants above, and keep the `main → production` promotion manual and approved.

## Local dev server

**The human owns the local dev servers** — they start, stop, and restart them. Each agent's worktree runs its dev server on a dedicated port:
- **Claude** (at `/Users/trebor/src/algebranch`): Runs on `http://localhost:3000` via `npm run dev`.
- **Gemini** (at `/Users/trebor/src/gemini/algebranch`): Runs on `http://localhost:3001` via `npm run dev:gemini`.

Agents must **not** launch the dev servers or poll them (no background runs, no health-check curl loops); that wastes tokens on something the human does instantly, and avoids port conflicts.

When a change needs verifying in the running app, **tell the human what to run and whether a restart is required**:
- **UI changes** (anything under `ui/src` — components, store, theme): Next dev hot-reloads. **No restart.**
- **`math-engine` changes**: require `npm run build` (rebuilds the `math-engine` dist the UI imports) **and** a dev-server restart to pick up the new bundle. **Flag this explicitly.**

Agents can still hand the user `?eq=<equation>` test URLs without the server running. Only start the server yourself if the human explicitly asks.

## Visual verification (headless screenshots)

For UI-heavy, layout-sensitive work (handle crowding, baseline alignment, scaling, spacing) **don't reason about `em`/`rem`/flow in your head — look at the real render.** Playwright is a committed `devDependency`; `scripts/shoot.mjs` (run via `npm run shoot`) loads the running app in headless Chromium and writes a PNG you can open/read directly. A screenshot is a faithful render of the actual app (real CSS, real layout), so it's the trustworthy way to confirm visual changes.

```sh
# dev server must be up (human-owned); fresh clones need: npx playwright install chromium
npm run shoot -- --eq "sqrt(4*9)+x=12"                       # default 1280x800 viewport
npm run shoot -- --eq "x^2-9=0" --width 480 --height 360     # small viewport → exercises useMathScale
npm run shoot -- --eq "sqrt(4*9)+x=12" --no-motion --hover "<css-selector>"
```

PNGs land in `screenshots/` (gitignored) by default; never commit them. Caveats to respect:
- **Animations are time-based** — a screenshot is one frame. Pass `--no-motion` for a clean static layout shot (e.g. when the `animate-ping` pulse would obscure spacing).
- **Hover/click states must be scripted** — use `--hover`/`--click` with a CSS selector to capture interaction-gated UI.
- **Scale is viewport-dependent** — `useMathScale` (0.4–2.8×) keys off container size, so set `--width`/`--height` deliberately to test scale extremes; a captured layout is only valid for that viewport.
- **The human owns the dev server** — this script points at the active dev server (automatically defaulting to `localhost:3000` for Claude or `localhost:3001` for Gemini based on the worktree path); it does not (and must not) start the server.

## Styling guardrails

- **Use semantic styling tokens**: Do not hardcode raw Tailwind color classes (e.g. `bg-indigo-600`, `text-amber-400`, `text-white/40`, etc.) in TSX files. Instead, add/use centralized styling constants inside the `THEME_GLASS` object in [theme.ts](ui/src/constants/theme.ts).

## Coordination & Hand-offs

- **Strictly human-triggered**: Handoff and pickup operations are human-triggered. Never perform or automate a handoff or pickup unless the user explicitly instructs you to do so. Do not auto-execute these processes on your own.
- **Worktree Isolation**: We run in separate git worktrees of the same repository. Claude operates in `/Users/trebor/src/algebranch`, and Gemini operates in `/Users/trebor/src/gemini/algebranch`. The `agent-relay` inbox files (`~/.local/state/agent-relay/algebranch/`) coordinate work transitions between our worktrees.
