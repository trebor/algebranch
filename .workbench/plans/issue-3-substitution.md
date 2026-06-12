---
status: active
issue: "#3 — Develop a mechanism for equation substitution / combining expressions (P0)"
branch: feat/equation-substitution (off main 2026-06-12)
updated: 2026-06-12
---

# #3: Equation substitution (Phase 1 — forward substitution)

If a variable is **isolated** in any other workspace (current equation is
`y = <expr>` or `<expr> = y`, with `y` absent from the expr side), that fact can
be substituted into the active workspace: matching variable nodes get a distinct
substitution handle that replaces `y` with `(expr)`.

## Design decisions (agreed with user 2026-06-12)

- **Facts = other tabs' CURRENT equations only** (not history nodes). Predictable:
  "what the tab shows is what you can use." Active tab excluded (circular).
- **Auto-detected, but visible**: a small "Known equations" strip shows available
  facts + source tab (provenance, discoverability, conflict legibility). Multiple
  tabs isolating the same variable simply yield multiple options per handle
  (the handle/action system already supports arrays — like quadratic ±).
- **In-place push, NOT a new workspace**: the history tree is the safety net —
  the pre-substitution equation remains as the parent node; branch to recover.
  A new workspace would sever the #18 transcript and break the one-tree model.
- **History tree visual treatment**: substitution nodes get a Replace-icon badge
  + accent styling, driven by `node.change?.op === 'substitute'` (the #18
  `change` field makes this free; precedent: TREE_NODE_LOOP). TooltipCard shows
  "substitute y = 2x + 1 (from tab …)".
- **Distinct handle icon**: lucide `Replace`, new THEME_GLASS tokens (guardrail:
  no raw colors in TSX).
- **Client-side computation**: `getSubstitutionOptions` is pure and imported from
  `math-engine` directly (#44 path) — no /api/math change, no scan-cache keys,
  instant handles.
- **Tutorial**: new chapter with an optional `facts` override field injected into
  the facts atom while the chapter runs — single workspace, no multi-workspace
  tutorial machinery. Copy explains the cross-workspace origin. (Alternative
  noted: spawn a real companion tab — deferred.)
- **Phase 2 = reverse/combining** (spot `m*c^2`, offer collapse to `E`): separate
  follow-up issue; needs subtree matching (matcher.ts exists).

## Engine surface (math-engine/src/substitute.ts, TDD)

```ts
interface SubstitutionFact { variable; expression: MathNode; sourceId?; sourceName? }
getIsolatedDefinition(eq): { variable, expression } | null   // pi/e excluded; var must be absent from expr side
getSubstitutionOptions(eq, facts): Record<path, SubstitutionOption[]>
  // SymbolNode paths matching fact.variable; replace with (expr) — parenthesize
  // OperatorNode replacements; ensureNodeIds; substituted Equation per option
describeSubstitution(variable, replacement): StepChange   // op: 'substitute' (extends rewrite union)
```

## UI wiring plan

1. `availableFactsAtom`: derive from tabsAtom (skip active tab), run
   getIsolatedDefinition on each tab's current equation.
2. `substitutionPathsAtom`: getSubstitutionOptions(currentEq, facts) memoized.
3. EquationNode: Replace-icon handle on matching SymbolNodes; preview tooltip
   (existing machinery); click → pushEquation(substituted, 'Substitute',
   describeSubstitution(...)) — provenance in change.detail.
4. Facts strip component (sidebar/canvas top, hidden when empty).
5. ControlPanel tree node badge for change.op === 'substitute'.
6. Onboarding: chapter `facts?: string[]` + injection; new Substitution chapter;
   onboarding engine-walk test supports a substitution step via the same pure fn.

## Status

- [x] Branch, board → In progress, design agreed
- [ ] Engine: substitute.ts + tests
- [ ] StepChange 'substitute' op + describeSubstitution
- [ ] Facts atom + substitution options atom
- [ ] Handle UI + theme tokens + preview
- [ ] Facts strip
- [ ] History-tree badge
- [ ] Tutorial chapter + facts override
- [ ] Verify in-app (URL-test loop), tests+build, merge; file Phase 2 issue
