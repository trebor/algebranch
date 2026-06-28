# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The monorepo uses a single unified version across all workspaces; the root
`package.json` is the source of truth. Releases are tagged `vX.Y.Z`.

## [Unreleased]

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

[Unreleased]: https://github.com/trebor/algebranch/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/trebor/algebranch/releases/tag/v1.0.0
