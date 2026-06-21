# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The monorepo uses a single unified version across all workspaces; the root
`package.json` is the source of truth. Releases are tagged `vX.Y.Z`.

## [Unreleased]

### Added
- Accessibility: an **Interface text size** control in Settings that scales the
  app's chrome (menus, labels, buttons) across four steps, independent of the
  equation canvas and persisted per browser. Cycle it from the keyboard with
  `T` / `Shift + T`.
- Keyboard shortcuts: `A` (About), `F` (Send feedback), `=` (global equals
  menu), `,` (Settings), and a `C` leader for copy/share (`C D` derivation,
  `C E` equation, `C L` equation link, `C W` workspace link).

### Changed
- Accessibility: interface text now scales in `rem` with a readable minimum
  size; chrome labels moved from ALL-CAPS to sentence case; line height and
  left alignment tuned for readability.
- `S` now swaps the two sides of the equation (previously `Ctrl/Cmd + Shift + S`),
  freeing the modifier chord now that copy/share live under the `C` leader.

## [1.0.0] - 2026-06-17

Initial public, open-source release of Algebranch — an interactive algebraic
derivation tool.

[Unreleased]: https://github.com/trebor/algebranch/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/trebor/algebranch/releases/tag/v1.0.0
