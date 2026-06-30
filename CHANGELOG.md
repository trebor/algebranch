# Changelog

All notable changes to this project are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and the monorepo uses a single unified version across all workspaces; the root
`package.json` is the source of truth and releases are tagged `vX.Y.Z`. From
v1.0.0 onward, entries are generated automatically from conventional commits by
[release-please](https://github.com/googleapis/release-please) (#337).

## [1.1.0](https://github.com/trebor/algebranch/compare/v1.0.0...v1.1.0) (2026-06-30)


### Features

* **math-engine:** self-quotient identity x/x -&gt; 1 ([#328](https://github.com/trebor/algebranch/issues/328)) ([#334](https://github.com/trebor/algebranch/issues/334)) ([606a218](https://github.com/trebor/algebranch/commit/606a2187da4395db8f2606e28893f23c956303d9))
* **ui:** degrade gracefully when extensions block the app bundle ([#326](https://github.com/trebor/algebranch/issues/326) follow-up) ([#330](https://github.com/trebor/algebranch/issues/330)) ([5082daa](https://github.com/trebor/algebranch/commit/5082daaf718142109bc3467b67fdf3d50035f877))
* **ui:** gracefully degrade under blocking browser extensions ([#326](https://github.com/trebor/algebranch/issues/326)) ([#329](https://github.com/trebor/algebranch/issues/329)) ([7f88690](https://github.com/trebor/algebranch/commit/7f886906df9af09a30b820b8d29e1e2ec9bb7638))
* **ui:** hotkeys for equals operations ([#322](https://github.com/trebor/algebranch/issues/322)) ([#332](https://github.com/trebor/algebranch/issues/332)) ([c48685b](https://github.com/trebor/algebranch/commit/c48685b0d93c157e854ed220b6fc1b32b32e5682))

## [1.0.0] - 2026-06-28

Initial public, open-source release of Algebranch — an interactive algebraic
derivation tool.

This release establishes the baseline feature set for interactive algebraic manipulation:

### Core Features
- **Guided Solving**: Equations are represented as movable, interactive terms. Users drive every step (e.g., crossing the equals sign, distributing, factoring) while the engine keeps the math correct.
- **Branching History Timeline**: A visual history tree that saves every step, allowing users to go back and explore alternative derivation paths without losing prior work.
- **Equivalence Validator**: A browser-run validation engine that uses interval arithmetic and equivalence points to verify every move and prevent invalid algebraic transformations.
- **Identity Library**: Support for standard algebraic rules (factoring, distribution, powers, logarithms, and trigonometry) applied with one-click handles.
- **Equation Library**: Over 80 pre-configured examples spanning linear equations, quadratics, and factoring.

### Accessibility & Assistive Tech (Pre-Launch Polish)
- **VoiceOver & Screen Reader Support**: Structured the DOM with semantic HTML landmarks and Aria roles, tuned accessible labels, and implemented roving focus management to ensure smooth navigation with VoiceOver and screen readers.
- **Interface Scaling**: Added an in-app text size control in Settings that scales the UI chrome across four levels, fully keyboard-navigable (`T` / `Shift + T`), to assist users with visual impairments.
- **Keyboard Navigation**: Added a comprehensive set of shortcuts (e.g., `A` for About, `F` for Feedback, `,` for Settings) and a `C` leader chord for copy/share actions.
- **Equation Swap**: Quick swap of left and right sides of the equation using the `S` key.
- **Motion Controls**: Built-in support for reduced motion preferences, disabling canvas transitions automatically when requested by the OS.
- **Visual Design**: Sleek dark mode styling and responsive scaling using Framer Motion.

[1.0.0]: https://github.com/trebor/algebranch/releases/tag/v1.0.0
