---
status: done
issue: "#44 — Unify on one math engine, retire the math-engine-client.ts duplication (closed)"
branch: refactor/unify-engine-retire-shim (merged to main 2026-06-11)
updated: 2026-06-11
---

> Shipped: merged to main 2026-06-11. The 569-line client shim is now a 35-line
> re-export of the real engine. Behavior verified byte-for-byte identical;
> client bundle unchanged (2332 KB on main and branch).

# #44: Retire the math-engine-client duplication

`ui/src/math-engine-client.ts` was a ~569-line verbatim copy of `math-engine/src`
(parse / format / AST helpers) — a drift hazard separate from the real engine
used by the `/api/math` backend route.

## What was verified before touching anything

- Engine is a strict superset: all 17 shim functions + 3 types exist in `math-engine`.
- Diffed every shared function: 16/17 byte-identical; the lone diff was
  `serializeNode` (engine calls internal `getLocalFunctionName`, which equals the
  exported `getFunctionName`). Types (`Equation`, `SerializedEquation`,
  `SerializedNode`) identical.
- Bundle risk (importing `getFunctionName` from `validator.ts` could pull the
  solver): measured client bundle on main vs branch — **identical, 2332 KB**.
  Tree-shaking keeps the heavy solver out; engine is mathjs + pure TS and the
  client already ships mathjs.

## Change

Replaced the shim body with explicit named re-exports of the client-relevant
surface from `math-engine` (NOT `export *`, to keep the heavy solver
engine-only). The 12 client import sites import from `'math-engine-client'`
unchanged. The alias now doubles as a curated "client-safe surface."

tsc + build clean; 187 engine tests green. No UI test harness, so equivalence
rests on the byte-identical diffs + tsc (strong — it is literally the same code)
+ a manual smoke test.

## Possible future (not needed)

- Delete the alias and import `math-engine` directly in all 12 files. Churn for
  little gain; the thin re-export is a fine end state.
