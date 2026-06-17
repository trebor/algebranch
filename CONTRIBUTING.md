# Contributing to Algebranch

Thanks for your interest in improving Algebranch! This guide covers how to get
set up, the workflow we follow, and the quality gate every change must pass.

## Contributor License Agreement (required)

Before your first contribution can be merged, you must sign the
[Contributor License Agreement](CLA.md). Algebranch is released under the
[GNU GPL v3](LICENSE); the CLA is a **license grant** that lets the Project
relicense or dual-license contributions in the future (for example, under a
commercial license) without having to re-contact every past contributor.

Signing is automated: the first time you open a pull request, the **CLA Assistant**
bot comments with a link and asks you to reply with a short confirmation. Once you
sign, the CLA status check turns green and stays green for all your future pull
requests. See [CLA.md](CLA.md) for the full terms, including the corporate variant.

## Development setup

Algebranch is a monorepo with two workspaces:

- **`math-engine`** — the framework-agnostic algebra engine (pure TypeScript, no
  DOM/React/Next dependencies). The UI consumes it through its public entry point.
- **`ui`** — the Next.js front end.

```sh
npm install          # install all workspace dependencies
npm run build        # compile math-engine, then ui
npm run dev          # start the dev server at http://localhost:3000
```

Changes to `math-engine` require a rebuild (`npm run build`) and a dev-server
restart for the UI to pick up the new bundle. Pure `ui` changes hot-reload.

## Workflow

1. **Branch first.** Never commit directly to `main`. Create a feature branch:
   `git checkout -b <type>/<short-description>` (e.g. `feat/…`, `fix/…`,
   `chore/…`).
2. **Write tests first (TDD).** For any new behavior or bug fix, add a failing
   test that captures the desired behavior, confirm it fails for the right reason,
   then write the minimum code to make it pass, then refactor with tests green.
   This applies to all `math-engine` logic and any testable `ui` logic (store,
   helpers, pure functions). For purely visual/interaction tweaks where a unit
   test genuinely can't lead, say so and verify manually in the running app.
3. **Keep the engine/UI boundary clean.** `math-engine` must not depend on
   React/Next/DOM; the UI imports the engine only through its public entry point.
4. **Open a pull request** against `main`. Describe what changed and how you
   verified it. Sign the CLA when prompted.

## Validation gate

Every change must pass the full gate before merge — run it locally:

```sh
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test             # test suite
npm run build        # compile math-engine, then ui
```

Pull requests are merged with **Squash and Merge** to keep history linear.

## Style

- 2-space indentation; arrow functions; `camelCase` for variables/functions,
  `UPPER_CASE` for constants.
- TypeScript strict mode — use `unknown`, never `any`.
- No magic numbers or hardcoded values; name them as `UPPER_CASE` constants.
- In the UI, use the semantic styling tokens in `ui/src/constants/theme.ts`
  rather than raw Tailwind color classes.

See [rules.md](rules.md) for the full engineering standards.
