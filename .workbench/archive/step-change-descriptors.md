---
status: done
issue: "#42 — math-engine: emit structured per-step change descriptors (closed)"
branch: feat/step-change-descriptors + feat/global-op-descriptors (both merged to main 2026-06-11)
updated: 2026-06-11
---

> Shipped: #42 closed, board → Done. Engine describes all three transformation
> kinds. Consumed by #18 (copy-derivation UI). For #18: the history tree does NOT
> persist the structured move, so capture the StepChange at move time and store
> it on the history node (don't re-derive by diffing equations).

# Per-step change descriptors (math-engine)

Precursor extracted from #18. Give the engine the ability to describe *what
operation* transformed one equation into the next, in precise algebraic terms
("subtract 4 from both sides", "divide both sides by 3", "evaluate 11 - 4 = 15").
#18 (copy derivation) and richer history labels/tooltips will consume this.

Pivot rationale: pure + decoupled + TDD-friendly, and it is the foundational
"educational" piece. #18 moved back to Ready; this is its dependency.

## Two kinds of change

```ts
type StepChange =
  | { kind: 'bothSides'; op: 'add'|'subtract'|'multiply'|'divide'|'sqrt'|'power'; operand?: string; text: string }
  | { kind: 'rewrite';  op: 'evaluate'|'simplify'|'distribute'|'identity'|'quadratic'; detail?: string; text: string };
```

## Engine surfaces (verified)

- **Transposition** — `generateValidMoves(eq, sourcePath): Record<targetPath, Equation>`
  in `math-engine/src/validator.ts:869`. Returns equations keyed by target path,
  NO labels. A cross-equals move (source side != target side, target = root of
  other side) is an inverse-op-on-both-sides:
  - moved node's parent `+` (addend) → subtract operand from both sides
  - parent `-` (subtrahend) → add operand
  - parent `*` (factor) → divide both sides by operand
  - parent `/` denominator → multiply both sides by operand; numerator → divide
  - operand text via the engine's node→string (`equationToString`/node toString).
  Same-side rearrangements → treat as a generic rewrite (not a clean both-sides op).
- **Reductions** — `getReducibleOptions(eq): Record<path, ReductionOption[]>` in
  `math-engine/src/simplify.ts:763`. `ReductionOption { path, simplified, type:
  'reduce'|'distribute'|'identity', label? }`. Labels already exist: 'Simplify',
  'Simplify Fraction', 'Distribute', 'Evaluate to Decimal', 'Express as
  Square/Cube', identity `rule.name`, 'Apply Quadratic Formula (+/-)', 'Expand
  Power'. These map to `kind:'rewrite'`.

## Approach (additive, no signature churn)

New exported pure functions in the engine (likely a new `describe.ts` re-exported
from `index.ts`):
- `describeTransposition(eq, sourcePath, targetPath): StepChange`
  - re-derive parent operator of `sourcePath` + cross-equals check from the
    original eq (small, localized; avoids changing `generateValidMoves`).
- `describeReduction(option: ReductionOption): StepChange`
  - map label/type → structured rewrite; for pure-numeric reduce, add
    `detail` like "11 - 4 = 15" if cheap.
- `StepChange` type exported from `index.ts`.

Deliberately NOT changing `generateValidMoves` / `getReducibleOptions` return
types (would ripple into UI `targetPathsAtom` / `reduciblePathsAtom`). Can inline
later if desired.

## TDD plan

`math-engine/tests/step-change.test.ts` — write failing first:
- `3*x - 4 = 11`, transpose `-4` → bothSides subtract? (note: term is `-4`, parent
  is binary `-`; expect "add 4 to both sides"). Verify sign logic carefully.
- `3*x = 15`, transpose the `3` factor → "divide both sides by 3".
- `x/5 = 2`, transpose denominator `5` → "multiply both sides by 5".
- `x + 4 = 11`, transpose `4` → "subtract 4 from both sides".
- reduction: `getReducibleOptions` on `11 - 4` → describeReduction → evaluate/simplify text.
Run via `npm test` (engine jest, currently 166 green).

## Scope for THIS (low) token budget

Prioritize transposition both-sides precision (highest value) + a thin reduction
wrapper. If budget runs out: transposition descriptors done + tested is a clean
shippable unit; reductions/UI (#18) follow.

## Done (Phase 1, 2026-06-11) — TDD, 173/173 green, UI build clean

- GH issue **#42** opened; #18 moved back to Ready.
- `math-engine/src/describe.ts` (new): `StepChange` type + `describeTransposition`
  + `describeReduction`; re-exported via `index.ts` (`export * from './describe'`).
- `math-engine/tests/step-change.test.ts` (new, 7 cases): the four both-sides
  transposition shapes (subtract/add/divide/multiply), same-side → null, and a
  reduction evaluate case.
- Additive only — no existing engine/UI signatures changed.
- **NOT committed yet.**

## Remaining / follow-ups

- ~~Global ops descriptors~~ **DONE** (`describeGlobalOp` in `describe.ts`, branch
  `feat/global-op-descriptors`): binary ops → add/subtract/multiply/divide;
  square/power → `power`; sqrt/root → `root`; operand is a parsable symbolic
  string. The engine now describes ALL THREE transformation kinds (transposition,
  reduction, global ops) — **#42 engine surface is complete.** Descriptors are
  reachable client-side via `math-engine` (validated in #43).

### Remaining (optional polish, not blocking #42)
- Edge cases deferred to generic fallback: binary-minus *minuend* moves,
  numerator-of-`/` moves, nested ParenthesisNode parents, unary minus.
- Operand/detail text uses mathjs `node.toString()`; consider routing through
  `formatNumber` (index.ts) for formatting parity with `equationToString`.
- Richer reduction detail (distribute/identity before→after).
- **UI wiring = #18**: walk the active path, call `describe*` per transition,
  render numbered derivation + justification; copy to clipboard.

## Next steps

1. Commit Phase 1 on `feat/step-change-descriptors`; push when ready.
2. Decide whether to extend descriptors to global ops now or proceed to #18 UI.
