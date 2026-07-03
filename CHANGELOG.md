# Changelog

All notable changes to this project are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and the monorepo uses a single unified version across all workspaces; the root
`package.json` is the source of truth and releases are tagged `vX.Y.Z`. From
v1.0.0 onward, entries are generated automatically from conventional commits by
[release-please](https://github.com/googleapis/release-please) (#337).

## [1.3.1](https://github.com/trebor/algebranch/compare/v1.3.0...v1.3.1) (2026-07-03)


### Bug Fixes

* **ui:** base64url the ?eq= share link so it survives social linkifiers ([#396](https://github.com/trebor/algebranch/issues/396)) ([167da20](https://github.com/trebor/algebranch/commit/167da2067a908122641ef4ee5d719f3126b03796)), closes [#395](https://github.com/trebor/algebranch/issues/395)

## [1.3.0](https://github.com/trebor/algebranch/compare/v1.2.0...v1.3.0) (2026-07-03)


### Features

* **a11y:** flatten associative operator chains in exploration reading ([#355](https://github.com/trebor/algebranch/issues/355)) ([6f4715b](https://github.com/trebor/algebranch/commit/6f4715bb1302b3ea0f6ae5ac998ee18c3be752ac)), closes [#290](https://github.com/trebor/algebranch/issues/290)
* first-class complex numbers — imaginary unit ⅈ, ℂ-arithmetic, complex roots ([#105](https://github.com/trebor/algebranch/issues/105)) ([#365](https://github.com/trebor/algebranch/issues/365)) ([369771e](https://github.com/trebor/algebranch/commit/369771ed7eff372e551002952acb178838e10b15))
* **math-engine:** self-power and radical-of-product identity rules ([#350](https://github.com/trebor/algebranch/issues/350)) ([645b95c](https://github.com/trebor/algebranch/commit/645b95c9cf7163f87ed7d77f73b61de0e1812e67))
* **tree:** overview zoom (3-lane middle mode) + active-path emphasis ([#305](https://github.com/trebor/algebranch/issues/305)) ([#361](https://github.com/trebor/algebranch/issues/361)) ([5e16c70](https://github.com/trebor/algebranch/commit/5e16c70679b588ef74e79241af1c92c7fb123326))
* **ui:** apply the sole option when its handle-menu preview is tapped ([#391](https://github.com/trebor/algebranch/issues/391)) ([c18d4e7](https://github.com/trebor/algebranch/commit/c18d4e7488eccdcfb80014b3f958f1df377d06ec)), closes [#390](https://github.com/trebor/algebranch/issues/390)
* **ui:** nudge dragged terms toward the two-tap move ([#386](https://github.com/trebor/algebranch/issues/386)) ([#387](https://github.com/trebor/algebranch/issues/387)) ([2b7f71d](https://github.com/trebor/algebranch/commit/2b7f71d9a868925e739bff8ebb25c3dc5b17a99e))
* **ui:** open the chooser menu on every handle click ([#369](https://github.com/trebor/algebranch/issues/369)) ([#371](https://github.com/trebor/algebranch/issues/371)) ([f48cab5](https://github.com/trebor/algebranch/commit/f48cab5463a14e89aa441da20953175c762dc766))
* **ui:** render associative chains as flat siblings ([#376](https://github.com/trebor/algebranch/issues/376)) ([d3838ec](https://github.com/trebor/algebranch/commit/d3838ec818186afcc2a11d77333d7c85306cddaf))


### Bug Fixes

* **ci:** point CLA gate at own fork on Node 24 ([#154](https://github.com/trebor/algebranch/issues/154)) ([#372](https://github.com/trebor/algebranch/issues/372)) ([0b34de9](https://github.com/trebor/algebranch/commit/0b34de9f3742a46fe6ba73eed19a440e4f26c8d2))
* **engine:** lock out no-op commutative reordering within an associative chain ([#377](https://github.com/trebor/algebranch/issues/377)) ([#382](https://github.com/trebor/algebranch/issues/382)) ([f1e39b1](https://github.com/trebor/algebranch/commit/f1e39b1bf212f5e1d317462aeebebd73d2d7120f))
* **engine:** make the head term of a subtraction chain transposable ([#354](https://github.com/trebor/algebranch/issues/354)) ([#385](https://github.com/trebor/algebranch/issues/385)) ([aa12091](https://github.com/trebor/algebranch/commit/aa12091fdfaea484dcf7f1fe74cb19ad1447bcd0))
* **engine:** normalize move-result trees to canonical, id-complete shape ([#380](https://github.com/trebor/algebranch/issues/380)) ([c6a2863](https://github.com/trebor/algebranch/commit/c6a28634fd9b1a6b7649cebaf3c41a03d76acc86))
* **math-engine:** stop flaky rejection of denominator-cleared moves ([#347](https://github.com/trebor/algebranch/issues/347)) ([#348](https://github.com/trebor/algebranch/issues/348)) ([3a0fa6d](https://github.com/trebor/algebranch/commit/3a0fa6d9f508f4d73eed59a2259f5ae560a14213))
* **ui:** don't surface arbitrary binary grouping of associative chains in interaction mode ([#374](https://github.com/trebor/algebranch/issues/374)) ([8df7697](https://github.com/trebor/algebranch/commit/8df7697cebf850fb1b8e3862e915d91d65d4413d))
* **ui:** full-screen bottom sheets with consistent dismissal in mobile landscape ([#351](https://github.com/trebor/algebranch/issues/351)) ([f31c185](https://github.com/trebor/algebranch/commit/f31c185db8b50115b68b78aaafb7a19b11aa74a7))
* **ui:** port tall nth-root index seating to the preview renderer ([#356](https://github.com/trebor/algebranch/issues/356)) ([#358](https://github.com/trebor/algebranch/issues/358)) ([1c881cb](https://github.com/trebor/algebranch/commit/1c881cbab6ed21c82cb728560e3a5b5476e37df3))
* **ui:** preserve node ids across reload so the slide animation survives ([#344](https://github.com/trebor/algebranch/issues/344)) ([#345](https://github.com/trebor/algebranch/issues/345)) ([6215f03](https://github.com/trebor/algebranch/commit/6215f0390119879274f00629f6899892cf0f3e82))
* **ui:** rework touch node/handle interactions ([#388](https://github.com/trebor/algebranch/issues/388)) ([#389](https://github.com/trebor/algebranch/issues/389)) ([0746545](https://github.com/trebor/algebranch/commit/07465456d495dcaa25826871fc83f2b779b63395))
* **ui:** seat the tall nth-root index cleanly in the crook ([#201](https://github.com/trebor/algebranch/issues/201)) ([#357](https://github.com/trebor/algebranch/issues/357)) ([e2b1260](https://github.com/trebor/algebranch/commit/e2b12601a3dbe4d4a7868ff8bf2bd3058844887d))
* **ui:** tooltip overflow + keycap consistency, plus library & equals-menu tooltips ([#245](https://github.com/trebor/algebranch/issues/245)) ([#352](https://github.com/trebor/algebranch/issues/352)) ([0470c3a](https://github.com/trebor/algebranch/commit/0470c3a2e95219b1e15bf131d900102bfe6ea792))

## [1.2.0](https://github.com/trebor/algebranch/compare/v1.1.0...v1.2.0) (2026-06-30)


### Features

* **ui:** export an equation as a PNG image ([#335](https://github.com/trebor/algebranch/issues/335)) ([#336](https://github.com/trebor/algebranch/issues/336)) ([174b0f8](https://github.com/trebor/algebranch/commit/174b0f88d6a38d5378244c6d878c7e30e59d5eb3))

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
