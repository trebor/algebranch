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
* **Preview Panel & Tooltips Decision:** Embedded full math expression previews directly inside the tooltips when hovering over action handles or destination nodes, and removed the bottom speculative preview workspace panel to maximize available workspace canvas area.

## Implementation Status

### Phase 1: Engine Rules and Tests (COMPLETE)
* [x] Add rewrite rules in [rules.ts](file:///Users/trebor/src/algebranch/math-engine/src/rules.ts).
* [x] Add unit tests in [rules.test.ts](file:///Users/trebor/src/algebranch/math-engine/tests/rules.test.ts).
* [x] Verify `areEquationsEquivalent` matches.

### Phase 2: UI Integration & Layout (COMPLETE)
* [x] Confirmed that the UI dynamically displays these identity handles when matching division nodes or reciprocal products.
* [x] Added inline math previews inside the action tooltips.
* [x] Added math previews when hovering over target destination nodes.
* [x] Added controlled tooltip preview of the sub-expression when hovering over selectable candidate terms before selection.
* [x] Corrected node highlight styling so that non-clickable (static) nodes, even if they have actions, do not get styled with a blue background/border (they remain dark/black).
* [x] Added vibrant indigo glow shadow effect (`shadow-[0_0_30px_rgba(129,140,248,0.45)]`) to help tooltips pop and stand out from canvas nodes.
* [x] Enforced a global singleton pattern for tooltips (`activeTooltipClose`) to guarantee that only one tooltip is ever visible on-screen at a time.
* [x] Resolved nested controlled tooltip edge cases by introducing an internal `isDismissed` override state in `Tooltip.tsx` and disabling parent candidate tooltips when child action handles are hovered (`hoverReducePath === null`).
* [x] Enlarged tooltip contents: default text size increased from text-xs to text-sm, header labels increased to text-xs, and math expressions increased from text-[1.1em] to text-[1.3em].
* [x] Removed the bottom speculative preview workspace panel and the dashed separator.
* [x] Re-configured the Active Derivation Workspace to take up the full panel canvas (flex-1).
* [x] Cleaned up unused variables, hooks, state atoms (`previewEquationAtom`), and components in `page.tsx` and the store.
* [x] Ran full test suite, verified linting, and verified Next.js production compilation.

## Next Steps
1. **User Validation:** User to verify full-screen canvas layout, tooltips previewing target moves, candidate selection preview tooltips, correct node background styling, tooltip singleton dismissal behaviour (including nested handle hovers), and enlarged tooltip sizing.
2. **Commit & Merge:** Commit changes and merge branch `feat/fraction-decomposition` to main.
3. **Archive Plan:** Set status to `done`, move plan to `archive/`, and update `INDEX.md`.
