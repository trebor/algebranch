---
status: active
issue: "#18 — feat(ui): Add ability to copy the complete derivation history"
branch: feat/copy-derivation (off main 2026-06-11)
updated: 2026-06-11
---

# #18: Copy the complete derivation history

Copy the active derivation path (root → current node) to the clipboard as clean
numbered steps, each with its equation and a justification. Consumes the #42
descriptors. Board: P0, In progress.

## Target output

```
1. 3*x - 4 = 11
2. 3*x = 11 + 4   (add 4 to both sides)
3. 3*x = 15       (evaluate 11 + 4 = 15)
4. x = 15 / 3     (divide both sides by 3)
5. x = 5          (evaluate 15 / 3 = 5)
```

Justification = `node.change?.text ?? node.label` (graceful fallback to the
coarse label for move types not yet descriptor-wired).

## Key design decision: capture at move time

The history tree stores only resulting equations + coarse labels, NOT the
structured move. Re-deriving at copy time would require diffing equations to
guess the op (rejected: fragile). So compute the `StepChange` where the move is
applied and store it on the resulting `HistoryNode`. `StepChange` is plain
serializable data → persists in sessions/tabs via the existing spread-based
serialize/deserialize (no extra work).

## Implementation steps

1. `HistoryNode.change?: StepChange` + `SerializedHistoryNode.change?: StepChange`
   (`ui/src/store/equation.ts`). serializeTree/deserializeTree already spread all
   fields, so it round-trips automatically.
2. `pushEquationAtom(newEq, stepLabel?, change?)` — store `change` on the new
   node. Optional arg; existing callers unaffected.
3. Wire descriptor computation at the three move sites:
   - Transposition: `EquationNode.tsx` `handleNodeClick` (has sourcePath +
     activeTargetPath) → `describeTransposition(currentEq, sourcePath, target)`.
   - Reduction: `EquationNode.tsx` reduce handler (~line 622, `action` is a
     `ReductionOption`) → `describeReduction(currentEq, action)`.
   - Global ops: store `applyGlobalOpAtom` → `describeGlobalOp(params)`.
   Import describe* + `StepChange` from `math-engine` (the #43-validated path).
4. `formatDerivation(tree, currentNodeId): string` (pure, in store or a util) +
   unit test.
5. Copy button in the History header — BOTH ControlPanel variants (desktop
   `return` ~276, mobile ~626). Reuse `handleCopyStep` clipboard + copied-state
   pattern; tooltip "Copy full derivation"; disabled when tree has only the
   initial node.

## Notes / open

- Markdown vs plain: plain numbered lines (the example doubles as a Markdown
  ordered list). LaTeX output is a separate future ask, not in #18.
- Loops: parentId chain is a unique path; loop bubbles are off-chain. No issue.

## Implemented (2026-06-11) — tsc + build clean, 186 engine tests green

- `HistoryNode.change?` + `SerializedHistoryNode.change?` (persists via spread).
- `pushEquationAtom(newEq, label?, change?)` stores `change` on the new node.
- `formatDerivation(tree, currentNodeId)` in the store (parentId walk, numbered
  lines, justification = `change?.text ?? label`, seen-guard).
- Descriptor capture wired at all three move sites:
  - transposition + reduction in `EquationNode.tsx` (describe* imported from
    `math-engine`; reduce reconstructs a ReductionOption from the UI action +
    this node's `path`),
  - global ops in `applyGlobalOpAtom`.
- Copy button in BOTH history headers: `ControlPanel` (desktop) and
  `TimelineContent` (mobile), Copy/Check copied-state, disabled when only the
  initial node exists.

## Verification status

Compiles + builds; **not yet exercised in the running app.** Worth a manual pass:
moves come from the backend `/api/math`, so descriptor capture only happens on a
live derivation. Check the copied transcript reads cleanly and that
descriptor-less moves (root±, swap) fall back to the label.

## Follow-ups (not blocking)

- Optional `formatDerivation` test (no UI jest harness today).
- Other push sites (root±, swap) could grow descriptors later.
