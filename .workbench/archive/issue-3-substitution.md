---
status: done
issue: "#3 — Develop a mechanism for equation substitution / combining expressions (P0; Phase 1 closed)"
branch: feat/equation-substitution (merged to main 2026-06-12)
updated: 2026-06-12
---

> Shipped: merged to main 2026-06-12; verified end-to-end in the running app
> (user transcript: substitute y = 2x+1 into 3y+2=14 and solve to x = 1.5, every
> step descriptor-justified). Phase 2 (reverse/combining, e.g. m·c² → E) filed as
> **#51**.

# #3: Equation substitution — Phase 1 (forward), SHIPPED

If a variable is isolated in any OTHER workspace's current equation, it becomes a
**fact** offered as a substitution in the active workspace.

## What shipped

- **Engine** (`math-engine/src/substitute.ts`, TDD 12 cases): `getIsolatedDefinition`
  (bare variable one side, absent from the other; pi/e excluded; works for both
  sides — `2y = x` isolates x), `getSubstitutionOptions` (per-occurrence options,
  precedence-safe parenthesization, multiple facts stack per node),
  `describeSubstitution` (StepChange op `'substitute'`, symbolic parsable detail).
- **Facts** (`availableFactsAtom`): derived live from other tabs' current
  equations (active tab excluded — circular); **identical definitions from
  multiple workspaces collapse into one fact with merged provenance** ("Tab A,
  Tab B"); commutative variants stay distinct. `tutorialFactsAtom` for chapter
  injection. Options computed client-side via the unified engine (#44), no API.
- **UI**: ONE teal Replace handle per variable node regardless of fact count
  (homogeneous alternatives → single affordance): one option applies directly;
  several → digit-proportioned count badge + click-opened chooser popover
  (portal, backdrop-dismissed, touch-friendly). Handle participates in the node
  box's principled sizing (paddingTop + minWidth handle count). In-place push —
  the history tree is the safety net (no new workspace).
- **Facts strip**: bottom-docked single scroll row (tab-bar overflow pattern),
  label "Substitutions", redundant source names collapsed (tab named by its own
  equation), Replace icon in its own teal disc, tooltips open upward
  (autoAlign={false}), mobile clearance for the fixed BottomNav (except during
  tours, when the nav is hidden).
- **History tree**: substitution nodes get a teal Replace badge; ALL step
  tooltips now show their change justification (TooltipCard description).
- **Tutorial**: Chapter 5 'Substitution' (`y + 4 = 10`, fact `y = 2 * x`) via a
  chapter-level `facts` field injected while the chapter runs — single-workspace
  teaching of the cross-workspace mechanism. Full tour guidance
  (onboardingSubstitutionAtom mirrors the reduce-handle lockdown; Next performs
  the substitution with its descriptor). Engine-walk test extended; all 5
  chapters reachable through real engine mechanisms.

## Key decisions (rationale in git history / this session)

- Facts = other tabs' CURRENT equations only (predictable).
- Auto-detected but visible (strip = provenance + discoverability + conflict legibility).
- No ± / no new workspace; one-tree model preserved; transcript (#18) shows
  "(substitute y = 2x + 1)".

## Follow-ups

- **#51** — Phase 2: reverse/combining (collapse `m * c ^ 2` → `E`), P2.
- Systemic note: nothing compensates for the fixed mobile BottomNav at layout
  level; FactsStrip carries its own clearance. If more bottom-docked UI arrives,
  fix at the panel level instead.
