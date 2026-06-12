---
status: done
issue: "#45 — Bug: taking the square root of both sides drops the negative root (± lost)"
branch: bugfix/sqrt-negative-root (merged to main 2026-06-12)
updated: 2026-06-11
---

> Shipped: merged to main 2026-06-12; verified in the running app (both ± branches reachable).

# #45: sqrt drops the negative root

`x^2 = 9` solved via √ ended at `x = 3`, silently dropping `x = -3`.

## Decision (Option A — fit the existing model)

The product has no native ± (mathjs has no ± operator — verified; `abs` exists but
`pm`/`±` do not). Solutions are handled via the existing **Root± toggle +
history branching**. The quadratic formula already offers two branching options
"(+)"/"(−)". So: make an EVEN root of a matching power offer **two ± reduction
options** instead of silently collapsing to the positive root. Odd roots stay
sign-safe (single collapse).

## Implementation (math-engine/src/simplify.ts)

- New `analyzeRootOfPower(node)` → `{ base, even }` for sqrt(e^2) / nthRoot(e^2)
  (even) and nthRoot(e^n, n) (even iff n is an even constant; symbolic n treated
  as sign-safe/odd since parity is unknown).
- `trySimplifyRootOfPower` now collapses ONLY odd roots (returns null for even),
  so even roots are no longer silently collapsed by getSimplificationForPath /
  autoSimplify.
- `getReducibleOptions` adds, for each even-root-of-power node, two options:
  `Take root (+)` → base, `Take root (-)` → -base (unaryMinus). Branches history
  like the quadratic formula. Mirrors `rawReductions.push` ± pattern.

## Tests

- `math-engine/tests/root-sign.test.ts` (new, 4 cases): ± options offered,
  even not single-collapsed, odd still collapses, parity classification.
- Updated 2 validator.test.ts tests that asserted the OLD lossy collapse
  (getSimplificationForPath even-root → now null; autoSimplify preserves even
  roots). `autoSimplify` has NO live UI callers (only an uninvoked /api/math
  action), so no live impact. Onboarding chapters still pass (Ch.2 reachable via
  the new "Take root (+)").
- Full suite 191 green; UI build clean.

## Verify in running app (DO before merge — UX-visible)

Solve `x^2 = 9` → √ both sides → on `sqrt(x^2)` you should now see TWO options:
"Take root (+)" → `x = sqrt(9)` and "Take root (-)" → `-x = sqrt(9)`. Both roots
(x = 3 and x = -3) reachable by branching. Confirm the reduce handles render both
(like the quadratic formula's two options).

## Next steps

1. Manual verify; commit; merge per user. Close #45, board Done, archive.
