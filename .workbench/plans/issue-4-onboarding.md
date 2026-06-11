---
status: active
issue: "#4 — Add a visual guide / interactive onboarding walkthrough for new users"
branch: feat/interactive-walkthrough
updated: 2026-06-11
---

# Issue #4: Interactive Onboarding Walkthrough

Migrated from Antigravity brain (`onboarding_guide_plan.md`, 2026-06-10) and updated to reflect what is actually built on `feat/interactive-walkthrough`.

## Audience & goals

Complete beginners — no algebra knowledge (isolating variables) and no app knowledge (click-to-transpose UI). Teach: **isolation**, **transposition** (sign flips crossing `=`), **simplification**, and the interactive UI itself.

## Chosen design

Three alternatives were considered (tutorial sandbox workspace / AST-anchored coach marks / auto-solver demo). **Alternative 1 — "Tutorial Workspace (Sandbox Level)"** was chosen and is being implemented:

- Tutorial runs in its own temporary workspace tab (`🎓 Tutorial: <chapter>`), created via `createNewSessionAtom`, so users can't wreck their real workspace.
- Progress is detected **live from the AST** — current equation is stringified and compared (whitespace-stripped) against each step's expected `nextEquation`. No fragile DOM selectors, zero drift.
- Completion persisted as `algebranch_onboarding_completed` in localStorage; welcome prompt auto-shows on first visit only.

## Implemented so far (uncommitted on this branch)

- **`ui/src/store/equation.ts`** (+314 lines): `OnboardingStep`/`OnboardingChapter` types; `ONBOARDING_CHAPTERS` content (4 chapters: 1. Basic Equations `3*x-4=11`, 2. Powers & Roots `x^2-9=0`, 3. Algebraic Identities `(x-3)*(x+3)=0`, 4. Global Operations `x/3=4`); atoms `onboardingChapterIdAtom`, `onboardingStepIndexAtom`, `onboardingHighlightPathAtom`, `onboardingShowDirectoryAtom`; actions `startOnboardingChapterAtom`, `setOnboardingStepAtom` (handles manual Next — pushes the expected equation if user hasn't done the move; and Back — steps history to parent).
- **`ui/src/components/OnboardingTour.tsx`** (new): welcome/chapter-directory modal; per-step floating coach card (bottom-center) with Back/Next/Exit; per-step `legend` field renders color legends in context — `nodeTypes` (chapter 1 step 0: variable/constant/operator/immobile) and `sourceTarget` (chapter 1 "Colors Changed!" step: indigo Source + emerald Target, taught the moment they first appear); all swatches derive from `THEME_GLASS`; auto-advance effect when current equation matches the step's `nextEquation` (or when user selects the expected `sourcePath` on selection steps); auto-regress when equation matches a previous step's start state.
- **Dual interaction mechanisms** (2026-06-11): every step can be completed two ways. (a) *Direct*: click the indicated element — node selection, glowing target, or simplify handle — detected via AST/sourcePath match as before. (b) *Next button performs it*: `setOnboardingStepAtom` now executes the real operation in tiers — live synced target slot (`targetPathsAtom` result matching the step's `nextEquation`) → live reduce handle (`reduciblePathsAtom`) → `globalOp` step field (new, used by Chapter 4's `{type:'mul', term:'3'}`) → fallback parse-and-push. Real-mechanism paths preserve FLIP animation + history labels. Selection steps were already performed by Next via `selectPath`.
- **Bugfix — regress bounce blocked Next on selection steps** (2026-06-11): auto-regress now only fires when the equation has left the current step's start state. Previously, steps sharing a start equation with their predecessor (selection → transpose pairs) made Next bounce straight back.
- **Bugfix — auto-advance skipping intro steps** (2026-06-11): steps are now classified statically from chapter data. A step whose `nextEquation` equals its starting equation is a *no-op step*: informational (`highlightPath: null`, Next-button only) or selection prompt (`highlightPath` set, advances on `sourcePath` match). Previously the live-equation comparison made Chapter 1 jump straight to step 2 on start.
- **Celebration finish** (2026-06-11): two-beat choreography on the final step. Beat 1: confetti bursts over the *open workspace* (no backdrop) so the solved equation stays visible for ~2s — workspace is fully click-gated on the final step so nothing can go wrong. Beat 2: backdrop fades in with the chapter-complete modal (spring-in trophy) plus a second confetti wave. Actions: **Next: <chapter>** (chains via `startOnboardingChapterAtom`), **All Chapters** (ends tour, reopens directory), **Explore Freely** / **Finish & Explore Freely** on the last chapter. No new dependencies.
- **`ui/src/components/EquationNode.tsx`**: the `onboardingHighlightPath` node is marked by a bright white annotation circle (`rounded-full` overlay overshooting the node box by 0.4em, white glow, gentle scale-breathe keyframe in `globals.css`) — deliberately outside the app's rounded-rect/hue vocabulary so it can't be confused with Candidate/Source/Target colors (an earlier indigo ring collided with Source). Rendered as a child of the node so it tracks FLIP/scaling for free. The circle also marks the destination on transpose steps via the derived `onboardingTargetPathAtom` (the synced target slot whose result equals the step's `nextEquation` — same matching as the Next-perform logic; appears once target analysis returns), and on simplify steps it marks the reduce *handle* button itself via `onboardingReduceHandleAtom` (action whose result matches the step's `nextEquation`), suppressing the node-box circle; falls back to the node box if no handle matches. During the tour, clicks are gated to the highlighted node (and valid targets once a source is selected); handles are locked down to *only* the one `onboardingReduceHandleAtom` identifies — no other handle renders on any node (an earlier highlightPath-based gate leaked the highlighted node's own unrelated handles, e.g. the 4's expand handle on chapter 1's selection step). On handle steps, node selection is locked out entirely (clicking the highlighted node — or a child whose blocked click bubbles up to it — used to select it as Source, going off-script).
- **`ui/src/components/Sidebar.tsx`**: "New Equation" button split into **Write** + **Tutorial** (Tutorial opens the chapter directory). Phrasing decision: see `archive/button-phrasing.md`.
- **`ui/src/app/page.tsx`**: `<OnboardingTour />` mounted. The equals sign (global-ops radial menu trigger) is locked during the tour except on `globalOp` steps, where it carries the white annotation circle instead (`onboardingGlobalOpAtom`) — chapter 4's first step previously had no visual indicator at all.

Verification status: `tsc --noEmit` passes (2026-06-11). **Not yet verified end-to-end in the running app.**

- **Scan prefetching** (2026-06-11): `ui/src/utils/mathScan.ts` — extracted the `/api/math` fetch + cache from `page.tsx` into `fetchMathScan` (adds in-flight deduplication), plus `prefetchChapterScans`: at chapter start, walks the known step chain deriving each future state from the previous scan's own results (targets/reduce actions), so node IDs — and cache keys — match the live session exactly. "Scan" = the candidate/target/reducible analysis round-trip. Underivable transitions (global ops) stop the chain silently; any divergence is just a cache miss → live fetch. Triggered by an effect in `OnboardingTour` guarded on the chapter's initial equation.

- **Chapter content extracted + engine-validated** (2026-06-11): `ONBOARDING_CHAPTERS` moved to `ui/src/constants/onboarding.ts` (pure data; store re-exports for compatibility). New `math-engine/tests/onboarding.test.ts` walks every chapter through the real engine (`getReducibleOptions`/`generateValidMoves`/globalOp construction — same derivation logic as the UI's matching) and fails with diagnostics if a step's `nextEquation` is unreachable or a `highlightPath` doesn't exist. It immediately caught: (a) the engine folds `0 + 9` during transposition, so chapters 2/3 scripted a state that never exists; (b) "transpose the power" is not an engine mechanic at all — chapters 2/3 root steps rewritten to use **global sqrt** (`globalOp: {type:'sqrt'}` → the circled `=`) followed by cancel/calculate simplify steps; (c) chapter 4's expected string had parens the formatter strips. All 4 chapters now pass (164 total tests).

- **RadialMenu tour guidance** (2026-06-11): on globalOp steps the radial menu is fully guided. Stage 1: the petal matching the step's op gets the annotation circle (sqrt/root and square/power share petal families); all other petals dim to 35% and lock. Stage 2: the parameter arrives **preset to the step's expected value and locked** (term input `readOnly`, spinner +/- disabled, no autofocus so mobile keyboards stay closed), so the circle lands directly on the Apply button; Apply stays `disabled` if the value were ever off-script (`tourInputSatisfied` fallback). Circle styling factored into `THEME_GLASS.ONBOARDING_CIRCLE` (was hand-copied in 3 places; now used in 6).

## Remaining work / open questions

1. ~~**Celebration finish**~~ — done 2026-06-11 (see Implemented above); still needs visual check in the running app.
2. **Interaction-model divergence** — plan taught "click term → action menu opens"; implementation pre-selects via `selectPath` and gates clicks instead. Confirm this is the intended teaching flow.
3. **Auto-regress logic** — the backward step-sync in `OnboardingTour.tsx` + `setOnboardingStepAtom` is the most complex, least-tested part. Exercise it (Back button, history-tree jumps mid-tour).
4. **End-to-end manual verification** of all 4 chapters, desktop + mobile (coach card is `bottom-20` — check clash with mobile BottomNav).
5. ~~**Hardcoded `highlightPath`s**~~ — done 2026-06-11: `onboarding.test.ts` asserts every `highlightPath` exists on the equation state its step starts from.
6. Chapter directory re-entry: "Tutorial" sidebar button sets `onboardingShowDirectoryAtom` — verify it works after completion flag is set.
