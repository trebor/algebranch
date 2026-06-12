---
status: active
issue: "#43 — refactor: route global ops through the math engine"
branch: feat/global-ops-in-engine (off main 2026-06-11, not pushed)
updated: 2026-06-11
---

# #43: Route global ops through the math engine

Global ops (√/×n/+/-/÷ on both sides) were applied ad-hoc in the store
(`applyGlobalOpAtom` hand-built AST with mathjs). Moved the AST mutation into
the single engine and had the store consume it from the **real** `math-engine`
(not the `math-engine-client` shim) — the first concrete step toward unifying on
one engine (#44).

## Done (2026-06-11) — TDD, 181/181 green, UI tsc + build clean

- `math-engine/src/globalOps.ts` (new): `GlobalOpType`, `GlobalOpParams`, and pure
  `applyGlobalOp(eq, params): Equation`. Each side gets its own operand subtree
  (no shared node refs — small improvement over the old store code). Re-exported
  via `index.ts`.
- `math-engine/tests/global-ops.test.ts` (new, 7 cases): square/power/sqrt/root,
  the four binary ops, throw-on-missing-term, and no-shared-refs.
- `ui/src/store/equation.ts`: `applyGlobalOpAtom` now imports `applyGlobalOp`
  **from `math-engine`** and only orchestrates (history push + display label).
  ~45 lines of hand-rolled AST construction removed.

## Significance

The UI building cleanly while importing `math-engine` client-side **validates
the unification thesis (#44)**: the real engine is mathjs + pure TS, mathjs is
already in the client bundle, so client-side use adds ~zero weight. This is the
path the #42 descriptors will use to reach the UI too.

## Next steps

1. Commit; push; merge to main (per-piece off main; FF).
2. On merge: status → done, archive, update INDEX. Move #43 board → Done.
3. Unblocked follow-ups: `describeGlobalOp` (in #42), and #44 (retire shim).
