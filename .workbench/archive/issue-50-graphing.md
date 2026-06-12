---
status: done
issue: "#50 — feat: graph expressions/equations to show variable relationships (P1)"
branch: feat/graphing (created 2026-06-12; completed and archived)
updated: 2026-06-12
---

# #50 Graphing — Phase 1 design & implementation plan

This plan is written to be executed without further design work. **Rationale is
inlined everywhere** — do not drop it when making changes; if you must deviate,
record why in this doc. Follow the Process Rails section exactly.

## 0. The product idea (do not lose this)

For a **single-variable** equation `LHS = RHS`, plot two curves over that
variable `v`:

- curve A: `value = LHS(v)`
- curve B: `value = RHS(v)`

**The horizontal coordinate of their intersection IS the solution.** As the user
derives (transpose, simplify, global ops), the two curves morph — but the
intersection's horizontal position never moves. The user literally watches the
algebra rearrange the picture while the answer stays nailed in place. That is
the teaching moment and the reason this feature exists.

Two deliberate "exceptions" that are FEATURES, not bugs:
- **Branch steps** (quadratic ±, "Take root (+)/(-)" from #45): an intersection
  visibly disappears at exactly the branch step. Squaring both sides can make
  one appear (extraneous solution). The graph *audits* the algebra.
- **Substitution steps** (#3): the equation's variable changes (e.g. y → x), so
  the whole graph, including the axis, is replaced. Expected.

### Empirically validated invariants (ran against the real engine, 2026-06-12)

These chains are engine-validated tutorial chapters. The numbers below are
ground truth; the test suite encodes them.

```
Ch1 linear:        3*x-4=11 → 3*x=11+4 → 3*x=15 → x=15/3 → x=5
  solutions {5} at EVERY step.  LHS(x=2) = 2,6,6,2,2  ← curves DO change shape;
  only the intersection x is invariant. The simplify step (3*x=11+4 → 3*x=15)
  left the curve value-identical (6→6): post-#33 a simplify is a local value
  identity, so simplify steps are the ONLY graph-identical steps.

Ch2 quadratic:     x^2-9=0 → x^2=9 → sqrt(x^2)=sqrt(9) → x=sqrt(9) → x=3
  solutions {-3,3},{-3,3},{-3,3},{3},{3}
  NOTE: global sqrt PRESERVES both solutions (sqrt(x^2)=3 still has x=±3);
  the loss happens at the "Take root (+)" branch step. Encode exactly this.

Ch5 substitution:  y+4=10 → 2*x+4=10 → 2*x=10-4 → 2*x=6 → x=3
  variable changes y→x at the substitution step; solution {6} (in y) → {3} (in x).
```

## 1. Architecture decisions (with rationale — keep these)

1. **Graphing MATH lives in `math-engine/src/graphing.ts`; only RENDERING lives
   in the UI.** Rationale: (a) pure functions → full TDD in the existing jest
   harness; (b) the single-engine thesis (#44) — the client imports the real
   engine at ~zero bundle cost because mathjs is already shipped;
   (c) every architectural lesson of this repo says math in the engine.
2. **SVG, not canvas.** Rationale: two polylines + axes + markers is a trivial
   element count; SVG gives retina-crisp lines, DOM hover (reuse the existing
   `Tooltip`), and — critical — theming via `THEME_GLASS` classes on paths,
   which the styling guardrail requires. Canvas only wins at hundreds of
   elements or 60fps pan/zoom; Phase 1 has neither.
3. **Roots: sign-change scan + refine with the engine's existing
   `solveForVariable`** (validator.ts) seeded from the bracketing interval.
   Rationale: reuse battle-tested machinery instead of hand-rolling Newton.
   Known limitation: tangency roots (e.g. `x^2 = 0`) produce no sign change —
   add a |f| local-minimum pass (accept minima with |f| < 1e-7) OR document the
   miss in a test. Do not silently skip this decision.
4. **Computation is client-side** via `import { computeGraphData } from
   'math-engine'`. No `/api/math` changes, no scan-cache interaction.
   2 curves × ~240 samples is microseconds; no debounce needed.

## 2. Engine API (`math-engine/src/graphing.ts`)

```ts
export interface GraphSample { x: number; y: number | null }
// y === null ⇒ undefined/complex/non-finite at that x ⇒ BREAK the polyline
// (e.g. sqrt(x) for x<0). Renderer starts a new path segment after a null.

export interface GraphWindow { xMin: number; xMax: number; yMin: number; yMax: number }

export interface GraphData {
  variable: string | null;     // null ⇒ not graphable; check `reason`
  reason?: 'no-variables' | 'multi-variable';
  variables: string[];         // all real variables found (for a future picker)
  lhs: GraphSample[];
  rhs: GraphSample[];
  intersections: number[];     // solution x positions, ascending
  window: GraphWindow;
}

export const getGraphVariables = (eq: Equation): string[];
export const sampleCurve = (node: math.MathNode, variable: string,
  xMin: number, xMax: number, count: number): GraphSample[];
export const findIntersections = (eq: Equation, variable: string,
  xMin: number, xMax: number): number[];
export const computeGraphData = (eq: Equation): GraphData;
```

Export `export * from './graphing'` from `math-engine/src/index.ts`
(append after `./substitute` — same pattern as #42/#43/#3).

### Implementation notes & GOTCHAS (all observed empirically — do not skip)

- **`getVariables` (validator.ts) returns FUNCTION NAMES as variables.**
  Observed: `getVariables` on `sqrt(x^2)` includes `'sqrt'` (FunctionNode.fn is
  a SymbolNode and the traversal doesn't skip it), which then crashes
  `evaluatePoint` with "Symbol x not in scope" if you trust vars[0].
  `getGraphVariables` must traverse skipping each `FunctionNode`'s `fn` symbol
  (walk `args` only) — implement properly, do NOT use a name blocklist.
  This deserves its own test: `sqrt(x^2) = sqrt(9)` → `['x']`.
- **`evaluatePoint` returns mathjs values that may be Complex / NaN / ±Infinity
  and THROWS on out-of-scope symbols.** Wrap per-sample in try/catch; map
  non-real (|imaginary| > 1e-9), NaN, and non-finite to `y: null`.
- **Window selection**: sample a wide probe range first (default −10..10,
  ~240 points). If intersections found, choose xMin/xMax to contain all of
  them with ≥ 25% padding on each side (min span 4). yMin/yMax from the 5th–95th
  percentile of finite sampled values of BOTH curves, padded ~10% — percentiles
  so an asymptote can't blow out the scale. Always include y=0 in the window
  (the axis must be visible).
- **Asymptotes**: between consecutive samples, if both finite but the jump is
  huge (|Δy| > 10 × window height), insert a `null` break so the renderer
  doesn't draw a fake vertical line.
- **findIntersections**: scan `f(x) = LHS(x) − RHS(x)` over the probe range;
  for each sign change, refine with `solveForVariable(eq.lhs, eq.rhs, variable,
  {}, midpointGuess)`; if it returns null/non-finite, fall back to bisection on
  the bracket (60 iters). Dedupe roots closer than 1e-4. Sort ascending.
- **multi-variable / no-variable**: `variables.length === 0` →
  `{ variable: null, reason: 'no-variables', ... }`; `> 1` →
  `{ variable: null, reason: 'multi-variable', variables, ... }` with empty
  curves. Phase 1 does NOT pick a variable for the user (a picker is Phase 2).

## 3. TDD plan — WRITE THE TESTS FIRST (`math-engine/tests/graphing.test.ts`)

Order of work: write this file, watch it fail, then implement graphing.ts to
green. Mirror the test style of `tests/substitution.test.ts` / `root-sign.test.ts`
(`const eq = (s) => ensureNodeIds(parseEquation(s))`, import everything
from `'../src'`).

1. `getGraphVariables`
   - `'sqrt(x ^ 2) = sqrt(9)'` → `['x']`  ← the function-name gotcha
   - `'E = m * c ^ 2'` → `['E','m','c']` (order-insensitive: sort before assert)
   - `'3 = 3'` → `[]`
2. `sampleCurve`
   - linear node `3*x-4` at known xs → exact values
   - `sqrt(x)` sampled over [−4, 4] → `y === null` for x < 0, numbers for x ≥ 0
3. `findIntersections`
   - `3*x - 4 = 11` → `[5]`
   - `x^2 = 9` → `[-3, 3]`
   - `x = x + 1` → `[]` (parallel lines, no solution)
   - `x^2 = 0` → `[0]` (tangency; if the minima pass was skipped, this test
     must exist as `it.failing`/documented-skip with a comment — do not delete)
4. **Derivation-chain invariance (the headline tests)** — for each chain in
   §0, walk every equation, compute intersections of its own variable, and
   assert the exact expected sets, INCLUDING where they change:
   - Ch1: `{5}` at all 5 steps
   - Ch2: `{-3,3}` for the first three, `{3}` for the last two
   - Ch5: `{6}` (var y) then `{3}` (var x) for the rest
   Rationale: this encodes the product's central promise as a regression test.
5. `computeGraphData`
   - multi-variable equation → `variable: null`, `reason: 'multi-variable'`
   - window contains all intersections and y=0
   - lhs/rhs sample arrays non-empty for a graphable equation

Run: `npm test -- graphing` from the repo root (workspace jest).

## 4. UI plan

### 4.1 Store (`ui/src/store/equation.ts`)

```ts
// Right-panel view selector (desktop): History tree vs Graph
export const rightPanelViewAtom = atom<'history' | 'graph'>('history');

// Graph of the current equation, computed client-side via the unified engine
export const graphDataAtom = atom((get) => {
  const eq = get(currentEquationAtom);
  if (!eq) return null;
  try { return computeGraphData(eq); } catch { return null; }
});
```
Import `computeGraphData` from `'math-engine'` alongside the existing engine
imports (same import line that has `applyGlobalOp`, `describeSubstitution` etc.).

### 4.2 `ui/src/components/GraphPanel.tsx` (new, `'use client'`)

SVG with `viewBox="0 0 W H"` (W=360 H=300 works), `width="100%"`,
`preserveAspectRatio="xMidYMid meet"`.

Layers, in order:
1. axes: horizontal at y=0, vertical at x=0 (when inside window) + 4–6 tick
   labels per axis (`niceTicks` helper can live in the component; it's
   presentation, not math).
2. curve LHS, curve RHS: `<path>` per contiguous non-null run of samples.
3. intersection markers: dashed vertical line through each intersection +
   a small circle at the crossing; wrap each marker in the existing `Tooltip`
   showing `x = 5` (or `v = 5` with the real variable name).
4. legend (top): two swatch chips — "left side" / "right side" with the
   `equationToString` of each side in mono.

**Axis labels: horizontal = the actual variable name; vertical = "value".**
Rationale: user equations frequently use `y` as a variable (all the #3 demos),
so labeling the vertical axis "y" is actively confusing. Do not use "y".

**Empty states** (center of panel, muted text):
- `reason === 'multi-variable'`: "Graphs are available for single-variable
  equations." + the variable list. (Picker is Phase 2.)
- `reason === 'no-variables'`: "Nothing to graph — no variables."

**Styling guardrail (hard rule)**: NO raw Tailwind color classes in TSX. Add
`THEME_GLASS` tokens, e.g.:
```
GRAPH_AXIS, GRAPH_TICK_TEXT, GRAPH_CURVE_LHS, GRAPH_CURVE_RHS,
GRAPH_INTERSECTION_LINE, GRAPH_INTERSECTION_DOT, GRAPH_LEGEND_CHIP
```
Color guidance: LHS indigo family, RHS amber family (matches Source/Simplify
vocabulary), intersection markers white/emerald. Do NOT use teal — teal is the
substitution vocabulary (#3).

SVG presentation attrs (`strokeWidth`, `fill="none"`, dash arrays) may be set
as attributes; colors come from token classNames.

### 4.3 Placement

- **Desktop**: the right sidebar currently renders `<ControlPanel />`
  (page.tsx ~line 989, inside the `rightSidebarOpen` wrapper). Add a small
  two-tab header (History | Graph) driven by `rightPanelViewAtom`, rendering
  `<ControlPanel />` or `<GraphPanel />`. Keep ControlPanel itself untouched.
- **Mobile**: do NOT add a 6th button to `BottomNav` (it has 5; crowding).
  Inside the History bottom sheet (which renders `TimelineContent`,
  see `activeBottomSheet === 'history'` in page.tsx), add the same
  two-tab header (Steps | Graph) and render `TimelineContent` or `GraphPanel`.
- The tab header is one shared tiny component or duplicated few lines — either
  is fine; tokens for active/inactive tab states (reuse `LIST_ITEM_ACTIVE`-like
  styling or add `PANEL_TAB_ACTIVE`/`PANEL_TAB_IDLE`).

### 4.4 Live behavior

`graphDataAtom` recomputes whenever the current equation changes (jotai
dependency). No animation in Phase 1 — discrete re-render per step is the
feature (curves "jump", intersection stays). Animated morphing is Phase 2 polish.

## 5. Phase 2+ (do NOT build now; file issues at close-out if not present)

- Residual-view toggle (`value = LHS − RHS`, solutions = x-intercepts).
- Variable picker for multi-variable equations; 2-var implicit relation plots.
- History-node hover → ghost overlay of that step's curves (morph across the
  whole derivation).
- Pan/zoom; animated curve interpolation between steps.
- A graphing tutorial chapter (needs the tour machinery to point at the panel).

## 6. Process rails (follow exactly; these are project law)

1. **Branch**: `git checkout feat/graphing` (already exists and carries this plan).
2. **Board**: move #50 → In progress at start, → Done at merge:
   ```sh
   id=$(gh project item-list 6 --owner trebor --format json --limit 100 | jq -r '.items[]|select(.content.number==50)|.id')
   gh project item-edit --id "$id" --project-id PVT_kwHOAMNZWs4BaYSq \
     --field-id PVTSSF_lAHOAMNZWs4BaYSqzhVQUn0 --single-select-option-id 47fc9ee4   # In progress
   # Done option id: 98236657
   ```
3. **TDD**: tests first (§3), then implementation. Engine work before UI work.
4. **Gates before ANY merge**: `npm test` (all suites green — 218+ as of
   2026-06-12) AND `npm run build --prefix ui` (includes tsc). Also run
   `(cd ui && npx tsc --noEmit)` after each UI edit.
5. **Never commit/push/merge without explicit user approval** (rules.md).
   Implement → verify → HALT and ask. Commits: imperative subject, body with
   rationale, `Co-Authored-By` trailer per repo convention (see git log).
6. **Verify with the user via the URL-test loop**: give clickable
   `http://localhost:3000/?eq=<encoded>` links plus EXACTLY what they should
   see. Encoder (parens/asterisks must be %-escaped or links break):
   ```sh
   node -e 'const enc=s=>encodeURIComponent(s).replace(/[()*!~.\x27]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());console.log("http://localhost:3000/?eq="+enc("3*x - 4 = 11"))'
   ```
   Good Phase-1 demo set: `3*x - 4 = 11` (line × horizontal, x=5);
   `x^2 = 9` (two intersections; then derive and watch one vanish at the ±
   branch); `E = m*c^2` (multi-variable empty state); then transpose/simplify
   `3*x - 4 = 11` step by step and confirm the intersection stays at x=5.
7. **Workbench**: update this doc as work progresses (status, what's done,
   surprises). On completion: status → done, add a "Shipped" blockquote, move
   to `.workbench/archive/`, update `INDEX.md`. On interruption: record exact
   next steps so a cold session can resume.
8. **Close-out**: close #50 with a summary comment, board → Done, file the
   Phase 2 issues (§5) if not already filed.

## 6.5 Phase 1.5 — Curve Value Hover Refinement (Refining hover coordinates/tooltip)

### Design Decisions & Rationale
1. **Dynamic Glassmorphic Tooltip**: We replace the static top-left HUD with an absolute-positioned floating tooltip that tracks the user's cursor dynamically inside the SVG view area. This avoids eye-travel cognitive load (keeping values near the point of interaction).
2. **Curve-Specific Highlights**: When hovering near/over a curve (or its legend), that specific curve's row in the tooltip will highlight (fully opaque, bolded, colored) while the other row dims (opacity-30). This connects the curve geometry directly to the evaluation details.
3. **Smart Position & Collision Detection**: The tooltip is kept within the graph panel bounding box. If the cursor gets too close to the right or top boundary, the tooltip automatically flips positions (left of the cursor / below the cursor) and is clamped within a 8px margin to prevent viewport overflow or scrollbars.
4. **Collision Avoidance with Solution Tooltips**: When hovering over a solution intersection line or circle, the cursor-following tooltip is hidden to prevent clashing/overlapping with the green solution tooltips.
5. **Horizontal Coordinate Probing vs. Equation Solutions**: Writing `{variable} = {value}` (e.g. `x = 1.25`) for a temporary probe point can confuse users into thinking the equation is solved. To resolve this, we display the horizontal axis arrow symbol `↔` for probe values (e.g., `↔ 1.25` in the floating tooltip), reserving `{variable} = {solution}` (e.g., `x = 5`) exclusively for the green intersection/solution tooltips where the equation is actually satisfied.
5. **中央 Theme Tokens**:
   - `GRAPH_TOOLTIP`: General background/backdrop glass styling.
   - `GRAPH_TOOLTIP_HEADER`: Independent variable title.
   - `GRAPH_TOOLTIP_ROW_ACTIVE`: Fully highlighted active curve value.
   - `GRAPH_TOOLTIP_ROW_INACTIVE`: Dimmed inactive curve value.
   - `GRAPH_TOOLTIP_ROW_DEFAULT`: Default state when not hovering over a curve.

## 7. Status checklist

- [x] Design agreed (user + 2 models, 2026-06-12); invariants validated empirically
- [x] Branch + board → In progress
- [x] `math-engine/tests/graphing.test.ts` written (failing -> passed)
- [x] `math-engine/src/graphing.ts` implemented to green (+ index export)
- [x] Store atoms (`graphSizeAtom`, `graphDataAtom`)
- [x] `GraphPanel.tsx` (SVG, ResizeObserver, tokens, empty states, intersection tooltips)
- [x] Main workspace split panel layout (Hidden, 1/3, 2/3) + clickable toggle handle
- [x] Theme tokens added (no raw colors in TSX)
- [x] Full gates green (compiles & tests pass)
- [x] User URL-test verification (incl. the ± vanish demo)
- [x] Implement Phase 1.5 Dynamic cursor tooltip + curve highlighting + collision detection
- [x] Add theme tokens for graphing tooltips in `theme.ts`
- [x] Swap FactsStrip and GraphPanel layout placement and adjust mobile bottom padding
- [x] Verify UI behavior and build correctness
- [x] Merge per approval; close #50; archive this doc; file Phase 2 issues (pending approval)

