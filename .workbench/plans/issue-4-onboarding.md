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
- **`ui/src/components/OnboardingTour.tsx`** (new): welcome/chapter-directory modal; per-step floating coach card (bottom-center) with Back/Next/Exit; node color legend on step 0; auto-advance effect when current equation matches the step's `nextEquation` (or when user selects the expected `sourcePath` on selection steps); auto-regress when equation matches a previous step's start state.
- **Celebration finish** (2026-06-11): final step of each chapter now renders a centered chapter-complete modal instead of the coach card — spring-in trophy, `ConfettiBurst` (28 framer-motion particles in the app's node colors), and actions: **Next: <chapter>** (chains via `startOnboardingChapterAtom`), **All Chapters** (ends tour, reopens directory), **Explore Freely** / **Finish & Explore Freely** on the last chapter. No new dependencies.
- **`ui/src/components/EquationNode.tsx`**: indigo pulse ring on `onboardingHighlightPath` node; during the tour, clicks gated to the highlighted node (and valid targets once a source is selected); Simplify handles hidden except on the highlighted path.
- **`ui/src/components/Sidebar.tsx`**: "New Equation" button split into **Write** + **Tutorial** (Tutorial opens the chapter directory). Phrasing decision: see `archive/button-phrasing.md`.
- **`ui/src/app/page.tsx`**: `<OnboardingTour />` mounted.

Verification status: `tsc --noEmit` passes (2026-06-11). **Not yet verified end-to-end in the running app.**

## Remaining work / open questions

1. ~~**Celebration finish**~~ — done 2026-06-11 (see Implemented above); still needs visual check in the running app.
2. **Interaction-model divergence** — plan taught "click term → action menu opens"; implementation pre-selects via `selectPath` and gates clicks instead. Confirm this is the intended teaching flow.
3. **Auto-regress logic** — the backward step-sync in `OnboardingTour.tsx` + `setOnboardingStepAtom` is the most complex, least-tested part. Exercise it (Back button, history-tree jumps mid-tour).
4. **End-to-end manual verification** of all 4 chapters, desktop + mobile (coach card is `bottom-20` — check clash with mobile BottomNav).
5. **Hardcoded `highlightPath`s** (`lhs/1`, `rhs`, …) — verify each matches the real AST path at that step; a parse difference silently breaks highlighting.
6. Chapter directory re-entry: "Tutorial" sidebar button sets `onboardingShowDirectoryAtom` — verify it works after completion flag is set.
