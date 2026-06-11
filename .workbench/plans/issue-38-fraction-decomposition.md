---
status: active
issue: "#38 — Support fraction decomposition transpositions (e.g. x/5 -> x * (1/5))"
branch: feat/fraction-decomposition
updated: 2026-06-11
---

# Issue #38: Support Fraction Decomposition Transpositions

We want to allow users to decompose division nodes (like `x / 5`) into coefficient multiplication nodes (like `x * (1 / 5)` or `(1 / 5) * x`), and merge them back.

## Proposed Design & Scope

### 1. Engine Rules (math-engine)
* **Decompose Rule:** Converts `A / B` into `A * (1 / B)`.
* **Merge Rule:** Converts `A * (1 / B)` or `(1 / B) * A` back into `A / B`.
  * Added to [rules.ts](file:///Users/trebor/src/algebranch/math-engine/src/rules.ts).
  * Verified rules test coverage in [rules.test.ts](file:///Users/trebor/src/algebranch/math-engine/tests/rules.test.ts).

### 2. Transposition UI Handles
* Decomposing is offered as an explicit identity transformation (inline handle button) when interacting with division nodes or reciprocals.
* **Decision:** Reverted the experimental drag-and-drop shortcuts for fraction decomposition/composition to avoid user confusion/surprises and to keep the interaction model highly predictable.

## Implementation Status

### Phase 1: Engine Rules and Tests (COMPLETE)
* [x] Add rewrite rules in [rules.ts](file:///Users/trebor/src/algebranch/math-engine/src/rules.ts).
* [x] Add unit tests in [rules.test.ts](file:///Users/trebor/src/algebranch/math-engine/tests/rules.test.ts).
* [x] Verify `areEquationsEquivalent` matches.

### Phase 2: UI Integration (COMPLETE)
* [x] Confirmed that the UI dynamically displays these identity handles when matching division nodes or reciprocal products.
* [x] Ran full test suite and verified Next.js production compilation.

## Next Steps
1. **User Validation:** User to test/verify the explicit click handle behavior in the browser.
2. **Commit & Merge:** Commit changes and merge branch `feat/fraction-decomposition` to main.
3. **Archive Plan:** Set status to `done`, move plan to `archive/`, and update `INDEX.md`.
