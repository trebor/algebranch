---
status: done
issue: "#40 — Validate quadratic formula identity (closed)"
branch: test/validate-quadratic-formula (merged to main 2026-06-12)
updated: 2026-06-12
---

> Shipped: merged to main 2026-06-12. Pure test hardening — no source change; the
> implementation was already correct.

# #40: Validate the quadratic formula identity

Added `math-engine/tests/quadratic-formula.test.ts` (11 cases) validating
`getQuadraticFormulaSolutions`. Strongest check: each formula branch root,
substituted back, satisfies the original equation. Covers: monic/positive,
mixed-sign, leading-negative, non-monic (a≠1), not-in-=0 form, quadratic on RHS,
complex roots (negative discriminant), double root (disc=0), and correct
rejection of b=0 (skipped → isolation), linear, and cubic. No bugs found;
implementation validated. 205 total tests green.
