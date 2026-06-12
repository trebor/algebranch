---
status: done
issue: "#41 — onboarding tour bug (closed); plus tooltip unification + UI polish (no separate issues)"
branch: bugfix/tour-source-reclick-deselect (merged to main 2026-06-11)
updated: 2026-06-11
---

> Shipped: branch merged to main 2026-06-11 after npm test + npm run build green.

# Onboarding fixes, tooltip unification & UI polish

One branch, `bugfix/tour-source-reclick-deselect`, gathering a run of onboarding
bug fixes (GitHub issue #41) plus follow-on tooltip and UI polish requested
interactively.

## State: complete, merged to main

All commits build clean (`npm run build`) and pass tests (166/166). Each change
was verified with tsc + build; UI changes still warrant a real-device pass
(several are mobile-only).

### Commits on the branch (oldest → newest)

1. `f957d40` docs — document Project 6 board as a prioritized work source in AGENTS.md.
2. `30dcf84` fix(onboarding) — issue #41 core: (a) re-clicking the selected source no longer deselects it (stopPropagation so the click can't bubble to the canvas deselect); (b) completed chapters recorded into `algebranch_completed_chapters` on reaching the celebration, so the directory shows the green check; (c) one workspace tab per chapter (tabs/sessions carry `chapterId`, `startOnboardingChapterAtom` finds-or-reuses); (d) per-chapter step progress via `algebranch_onboarding_steps` map (replaces the single `onboarding_step_index` key that one chapter clobbered another's), plus an `appHydratedAtom` gate so auto-resume can't overwrite localStorage pre-hydration.
3. `27c73df` fix(onboarding) — bind the coach card to the active tab via `syncTourToActiveTabAtom`: switching to a non-tutorial tab hides it, returning to an in-progress tutorial tab reopens it at the saved step. Fires on real tab switches only.
4. `4c52121` feat(ui) — unify entity tooltips with a shared `TooltipCard` (workspaces, tabs, library, history): eyebrow / title / description / large typeset equation / footer. New `THEME_GLASS.TOOLTIP_*` tokens. Width capped at `min(92vw,40rem)`.
5. `dea86c2` refine(ui) — step meta moved to the top-right slot (matches history "Step N"); the Saved Workspaces dropdown trigger uses the same `sessionTooltipCard` as its items.
6. `445e3fb` feat(ui) — rename the "Write" button → "New"; add tooltips to the New + Tutorial buttons.
7. `041bb64` ui — Algebranch logo (not the Sparkles/AI icon) in the tutorial welcome header.
8. `183b044` ui — suppress the automatic PWA install prompt (`beforeinstallprompt` preventDefault); manifest/SW kept, manual install still works. Production-only effect.
9. `9493c34` fix(ui) — keep the top tab bar visible during the tutorial on mobile so users aren't trapped in a tutorial-type workspace (the bottom nav stays hidden during a step since it's fixed-bottom and would overlap the docked coach card).

### Key files

- `ui/src/store/equation.ts` — `chapterId` on tab/session, per-chapter step map (`readOnboardingSteps`/`writeOnboardingStep`/`clearOnboardingStep`), `appHydratedAtom`, `startOnboardingChapterAtom` reuse logic, `syncTourToActiveTabAtom`.
- `ui/src/components/OnboardingTour.tsx` — tab-bound coach, hydration-gated resume, completion recording, logo header.
- `ui/src/components/TooltipCard.tsx` (new) — shared tooltip content.
- `ui/src/components/Sidebar.tsx`, `WorkspaceTabs.tsx`, `ControlPanel.tsx` — adopt TooltipCard.
- `ui/src/app/page.tsx` — PWA prompt suppression, tutorial tab-bar visibility.
- `ui/src/constants/theme.ts` — `TOOLTIP_*` tokens.

## Follow-ups after merge

- Real-device mobile pass of the tutorial trap fix and the tooltips (several changes are mobile-only / visual).

## Loose ends (not blocking this branch)

- **Board status for #38**: issue closed, but the Project 6 board still shows it `Research`. Needs `gh auth refresh -s project` (interactive) then a board status flip — token currently lacks the `project` scope.
- A "second issue" the user mentioned mid-session was never described/captured.
