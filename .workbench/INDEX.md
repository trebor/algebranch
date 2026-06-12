# Workbench Index

Entry point for shared agent state. One line per doc — keep current. Protocol: see `AGENTS.md` at repo root.

## Active

*(No active tasks)*

## Archive

- [archive/issue-3-substitution.md](archive/issue-3-substitution.md) — `done` — #3: cross-workspace equation substitution Phase 1 (facts, teal handles + chooser, strip, tree badge, tutorial Chapter 5); merged to main 2026-06-12. Phase 2 = #51.

- [archive/issue-40-validate-quadratic.md](archive/issue-40-validate-quadratic.md) — `done` — #40: validate the quadratic formula identity; 11-case test suite (substitution-satisfaction, edge cases); merged to main 2026-06-12. No bug found.

- [archive/issue-33-denominator-removal.md](archive/issue-33-denominator-removal.md) — `done` — #33: node removal gated on a local identity (areExpressionsValueEqual), killing the bogus denominator Simplify handle; merged to main 2026-06-12.

- [archive/issue-45-sqrt-negative-root.md](archive/issue-45-sqrt-negative-root.md) — `done` — #45: even roots offer a ± branch (Take root +/−) instead of dropping the negative root; merged to main 2026-06-12.

- [archive/issue-44-unify-engine.md](archive/issue-44-unify-engine.md) — `done` — #44: retire the math-engine-client duplication (569→35 line re-export); merged to main 2026-06-11. Behavior byte-identical, bundle unchanged.
- [archive/issue-18-copy-derivation.md](archive/issue-18-copy-derivation.md) — `done` — #18: copy the complete derivation history; merged to main 2026-06-11. Captures StepChange at move time; consumes #42 descriptors. Follow-up: ± negative-root dropped (#45).
- [archive/step-change-descriptors.md](archive/step-change-descriptors.md) — `done` — #42: per-step change descriptors (transposition+reduction+global-ops); merged to main 2026-06-11.
- [archive/issue-43-global-ops-engine.md](archive/issue-43-global-ops-engine.md) — `done` — #43: route global ops through the math engine; merged to main 2026-06-11. Validated the #44 client-side engine-import path.
- [archive/issue-41-onboarding-tooltips.md](archive/issue-41-onboarding-tooltips.md) — `done` — Issue #41 onboarding fixes + tooltip unification + UI polish; branch `bugfix/tour-source-reclick-deselect` merged to main 2026-06-11.
- [archive/issue-38-fraction-decomposition.md](archive/issue-38-fraction-decomposition.md) — `done` — Issue #38: Support fraction decomposition transpositions (e.g. x/5 -> x * (1/5)).
- [archive/issue-39-semantic-styling.md](archive/issue-39-semantic-styling.md) — `done` — Issue #39: Adopt semantic styling tokens and replace raw Tailwind colors with theme constants.
- [archive/issue-4-onboarding.md](archive/issue-4-onboarding.md) — `done` — Issue #4 interactive onboarding walkthrough: 4 engine-validated chapters, dual Next/click mechanisms, annotation circles, guided radial menu, two-beat celebration; merged to main 2026-06-11.
- [archive/button-phrasing.md](archive/button-phrasing.md) — `done` — "Write" vs "Enter" equation button phrasing; resolved as Write + Tutorial split.
