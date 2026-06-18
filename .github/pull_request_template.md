<!--
Thanks for contributing to Algebranch! Please fill out the sections below.
See CONTRIBUTING.md for the full workflow and quality gate.
-->

## What this changes

<!-- A short description of the change and the motivation. -->

## Related issue

<!-- e.g. Closes #123 -->

## How I verified it

<!--
Tests added/updated, and/or manual verification steps. For UI changes,
include a `?eq=` test link or screenshots where helpful.
-->

## Checklist

- [ ] Branched from `main` (not committing directly to `main`).
- [ ] Followed TDD where applicable — added a failing test first, then the code (or noted why a unit test can't lead, for purely visual/interaction tweaks).
- [ ] Ran the full validation gate locally: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`.
- [ ] Kept the engine/UI boundary clean (`math-engine` has no React/Next/DOM deps).
- [ ] Used semantic styling tokens from `ui/src/constants/theme.ts` for any UI color/styling (no raw Tailwind color classes).
- [ ] I have signed the [CLA](https://github.com/trebor/algebranch/blob/main/CLA.md) (the bot will prompt on first PR).
