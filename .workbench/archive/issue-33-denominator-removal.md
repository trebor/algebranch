---
status: done
issue: "#33 — Bug: denominator constant 5 offered a Simplify handle in (3*x^2+x-2)/5 = 0"
branch: bugfix/denominator-simplify-handle (merged to main 2026-06-12)
updated: 2026-06-12
---

> Shipped: merged to main 2026-06-12; verified in-app (5 inert; x+0 / x*1 still simplify).

# #33: denominator constant offered a bogus Simplify handle

`(3x²+x-2)/5 = 0` offered a "Simplify" handle on the prime constant `5`; clicking
it cleared the denominator → `3x²+x-2 = 0`, mislabeled and misattributed to the 5.

## Root cause (the real insight)

Single-node removal was validated by `areEquationsEquivalent` = **same solution
set**. That is the wrong criterion for a *simplification*. Removing the `5` keeps
the same roots ONLY because the other side is 0 (`A/5 = 0 ⟺ A = 0`, a both-sides
multiply), not because it is a local simplification of the 5. The same too-loose
gate is outright **lossy for a variable denominator** (`A/x = 0 → A = 0` drops
x≠0) — the deeper hazard the user intuited.

## Fix

A genuine simplification is a **local identity**: the modified side keeps its
value for ALL variable assignments (e.g. `x+0 → x`), not merely the same roots.

- New `areExpressionsValueEqual(a, b)` in `validator.ts`: samples several points
  (avoiding 0), requires value-equality at every valid sample. Stronger than
  equation equivalence.
- `simplify.ts` single-removal (both sites: getSimplificationForPath ~573 and
  autoSimplify ~698) now gates on `areExpressionsValueEqual(eq[side], cand[side])`
  instead of `areEquationsEquivalent`. Rejects denominator/factor removals that
  are equation-structure coincidences; keeps identity-element removals.

## Tests

- `denominator-removal.test.ts` (new, 3 cases): denominator constant not offered;
  variable denominator not offered; areExpressionsValueEqual unit (identity vs
  coincidence).
- Full suite 194 green (no regressions — legitimate simplifications still pass).
  UI build clean.

## Verify in running app (DO before merge)

Enter `(3*x^2 + x - 2)/5 = 0`. The `5` should NO LONGER show a Simplify handle.
Spot-check that normal simplifications (x+0, x*1, fraction reduction, etc.) still
work elsewhere.

## Next steps

1. Manual verify; commit; merge per user. Close #33, board Done, archive.
