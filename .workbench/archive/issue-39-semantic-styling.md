---
status: done
issue: "#39 — Adopt semantic styling tokens: replace hardcoded Tailwind colors with theme constants"
branch: feat/styling-tokens
updated: 2026-06-11
---

# Issue #39: Adopt Semantic Styling Tokens

We are replacing hardcoded Tailwind CSS colors and styling classes with centralized semantic tokens to allow easier retheming, prevent color drift, and make JSX markup more readable and semantic.

## Design Decision
Following user preference, we are adopting **Option A**:
* Extend the existing `THEME_GLASS` object in [theme.ts](file:///Users/trebor/src/algebranch/ui/src/constants/theme.ts) with general UI chrome tokens (e.g., primary buttons, panel borders, muted text, panel headers).
* Avoid hardcoding raw colors (`indigo-600`, `white/40`, hex values like `#110f22`) in components.

## Planned Tokens (to add to `THEME_GLASS`)
We will centralize styling concepts like:
* **Backgrounds & Panels:** Tree canvas background, Sidebar panels, modals.
* **Borders:** Subtle panel/card borders (`border-white/5`, `border-white/10`).
* **Text & Muted Indicators:** Muted descriptions (`white/40`, `white/50`, `white/70`).
* **Action Buttons:** Primary action buttons (`bg-indigo-600` states), danger buttons (`bg-red-500` states), secondary/translucent buttons.
* **Glows & Shadows:** Accent shadow glows for primary/focus states.

## Step-by-Step Execution Plan

### Phase 1: Extend Theme Constants
1. Add new chrome tokens to `THEME_GLASS` in [theme.ts](file:///Users/trebor/src/algebranch/ui/src/constants/theme.ts).
2. Validate that typing is preserved.

### Phase 2: Incremental Component Sweeps
We will update components one by one, verifying the build and tests after each sweep:
1. **[Sidebar.tsx](file:///Users/trebor/src/algebranch/ui/src/components/Sidebar.tsx)** (Committed in `015395a`)
2. **[ControlPanel.tsx](file:///Users/trebor/src/algebranch/ui/src/components/ControlPanel.tsx)** (Committed in `27f3ad5`)
3. **[OnboardingTour.tsx](file:///Users/trebor/src/algebranch/ui/src/components/OnboardingTour.tsx)** (Committed in `84cf696`)
4. **[FeedbackModal.tsx](file:///Users/trebor/src/algebranch/ui/src/components/FeedbackModal.tsx)** (Committed in `e58ca2a`)
5. **[page.tsx](file:///Users/trebor/src/algebranch/ui/src/app/page.tsx)** (Committed in `6805369`)
6. **[EquationNode.tsx](file:///Users/trebor/src/algebranch/ui/src/components/EquationNode.tsx)** (Swept, uncommitted)
7. **[RadialMenu.tsx](file:///Users/trebor/src/algebranch/ui/src/components/RadialMenu.tsx)** (Swept, uncommitted)

### Phase 3: Add Guardrails
* Update [AGENTS.md](file:///Users/trebor/src/algebranch/AGENTS.md) or a new custom linter rule to warn about raw tailwind color classes.
