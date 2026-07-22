# Changelog

All notable changes to this project are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and the monorepo uses a single unified version across all workspaces; the root
`package.json` is the source of truth and releases are tagged `vX.Y.Z`. From
v1.0.0 onward, entries are generated automatically from conventional commits by
[release-please](https://github.com/googleapis/release-please) (#337).

## [1.5.0](https://github.com/trebor/algebranch/compare/v1.4.0...v1.5.0) (2026-07-22)


### Features

* **a11y:** carry the keyboard cursor across Exploration ↔ Interaction switches ([#373](https://github.com/trebor/algebranch/issues/373)) ([#517](https://github.com/trebor/algebranch/issues/517)) ([de2a4af](https://github.com/trebor/algebranch/commit/de2a4af031690196c2a852b9212c4a1b139a8306))
* **a11y:** implement keyboard navigation, skip-links, roving toolbars, and pane cycling ([993922d](https://github.com/trebor/algebranch/commit/993922d366f8fc09fd8fa8ff8e8ff4b104558f96))
* add problem ladders and practice sets with local storage hydration ([#548](https://github.com/trebor/algebranch/issues/548)) ([000d689](https://github.com/trebor/algebranch/commit/000d689a0fcde30293bbdc696490753dafa04898))
* add progressive simplification mode ([#368](https://github.com/trebor/algebranch/issues/368)) ([#533](https://github.com/trebor/algebranch/issues/533)) ([6b7c168](https://github.com/trebor/algebranch/commit/6b7c168ddd4091b59ad2cf59a1625590ae88da41))
* **engine,ui:** freeze the tree on terminal conclusions ([#487](https://github.com/trebor/algebranch/issues/487)) ([#494](https://github.com/trebor/algebranch/issues/494)) ([f4170f2](https://github.com/trebor/algebranch/commit/f4170f2dcf08ef6326f9c21fd807b7b5306dc910))
* **feedback:** first-party POST endpoint so feedback needs no GitHub account ([#519](https://github.com/trebor/algebranch/issues/519)) ([#528](https://github.com/trebor/algebranch/issues/528)) ([4c00d89](https://github.com/trebor/algebranch/commit/4c00d894554ad6773ee437b96a6120082fd1b6d7))
* **math-engine:** normalize middle-dot, ≤/≥, vulgar fractions, ∛/∜ ([#394](https://github.com/trebor/algebranch/issues/394)) ([#473](https://github.com/trebor/algebranch/issues/473)) ([5a8b3da](https://github.com/trebor/algebranch/commit/5a8b3da2393afcdcd682388d73a2f74599877f93))
* **ops:** first-party privacy-clean error beacon ([#505](https://github.com/trebor/algebranch/issues/505)) ([#526](https://github.com/trebor/algebranch/issues/526)) ([39425e3](https://github.com/trebor/algebranch/commit/39425e3790b3074a8e01838db11e2cb7c821e235))
* practice sets structural equation variations ([#546](https://github.com/trebor/algebranch/issues/546)) ([#552](https://github.com/trebor/algebranch/issues/552)) ([c26182e](https://github.com/trebor/algebranch/commit/c26182e5506fc7ae962307318f177981c372609c))
* **practice:** refine equation completion conditions and teach equation flipping ([#553](https://github.com/trebor/algebranch/issues/553)) ([f81fcd7](https://github.com/trebor/algebranch/commit/f81fcd7683705094d281b02e6cebf02ace3c0c56))
* **presets:** audit and reorganize library presets, SEO solve pages, and tooltip variable lists ([#499](https://github.com/trebor/algebranch/issues/499)) ([#543](https://github.com/trebor/algebranch/issues/543)) ([68ccf66](https://github.com/trebor/algebranch/commit/68ccf6661cb29e60df66e381c996d5ee6c987979))
* replace presets with dynamic capability gates and rename progressive mode ([#538](https://github.com/trebor/algebranch/issues/538)) ([cb9f510](https://github.com/trebor/algebranch/commit/cb9f510e36ab1b5ef87af2454783870e9285e77f))
* **seo,docs,ui:** mirror docs onto the domain with per-page structured data ([#509](https://github.com/trebor/algebranch/issues/509)) ([#515](https://github.com/trebor/algebranch/issues/515)) ([3b2dcf8](https://github.com/trebor/algebranch/commit/3b2dcf85f8c0e64aa9a69cd6400cc6eb4ecb8dab))
* **seo,ui:** AI-discoverable crawl surface, deep-link spec, and secondary-route hydration fix ([#508](https://github.com/trebor/algebranch/issues/508)) ([9215652](https://github.com/trebor/algebranch/commit/9215652da2023fcf1197c03bcda665702592fcbc))
* **share:** first-party zero-knowledge short links at /s#key ([#480](https://github.com/trebor/algebranch/issues/480)) ([#483](https://github.com/trebor/algebranch/issues/483)) ([9b21f7a](https://github.com/trebor/algebranch/commit/9b21f7a9c21cef6b36509ed9606bf0f27d633d37))
* **share:** global daily write budget on short-link creates ([#505](https://github.com/trebor/algebranch/issues/505)) ([#525](https://github.com/trebor/algebranch/issues/525)) ([65db02e](https://github.com/trebor/algebranch/commit/65db02eb97780501d8313fb0f356577e61c984aa))
* **ui,docs:** dedicated equation-input-format reference; replace math.js link ([#513](https://github.com/trebor/algebranch/issues/513)) ([3dc2f30](https://github.com/trebor/algebranch/commit/3dc2f3035ffc23ae530ea1e98b9aaf9fc3fd0cfe)), closes [#507](https://github.com/trebor/algebranch/issues/507)
* **ui,docs:** unify help + shortcuts into one URL-addressable source of truth ([#514](https://github.com/trebor/algebranch/issues/514)) ([#516](https://github.com/trebor/algebranch/issues/516)) ([5b36934](https://github.com/trebor/algebranch/commit/5b3693476fd4429b3386f040be29c98a46cbe4f8))
* **ui:** add interactive Wikipedia explanation links to chooser option rows ([#535](https://github.com/trebor/algebranch/issues/535)) ([f70df5e](https://github.com/trebor/algebranch/commit/f70df5e223b116937d7dfdc62e98fb78eaaa6bb4))
* **ui:** add user-controlled animation speed settings and heal duplicate AST keys ([#478](https://github.com/trebor/algebranch/issues/478)) ([2902689](https://github.com/trebor/algebranch/commit/29026896a63eebc0553043e0357382bcbb791798))
* **ui:** classroom settings polish and keyboard-only focus tooltips ([#540](https://github.com/trebor/algebranch/issues/540)) ([b03f73d](https://github.com/trebor/algebranch/commit/b03f73d5ef1e9b8a3dcecd78980f1816ce4368d5))
* **ui:** diff-emphasized transform previews ([#423](https://github.com/trebor/algebranch/issues/423)) ([#467](https://github.com/trebor/algebranch/issues/467)) ([693c61e](https://github.com/trebor/algebranch/commit/693c61e9f9f5aa465543785c4578d1721efe774b))
* **ui:** global Escape dismissal for the shared-workspace banner ([#484](https://github.com/trebor/algebranch/issues/484)) ([#496](https://github.com/trebor/algebranch/issues/496)) ([4adc255](https://github.com/trebor/algebranch/commit/4adc2559ad998583e395208fdb3cc36e1c6e44ef))
* **ui:** interactive tooltips with hover bridge and exit dismissal ([#544](https://github.com/trebor/algebranch/issues/544)) ([3f386a8](https://github.com/trebor/algebranch/commit/3f386a844cb10a0da6f7567922bbe2ffe39f9e94))
* **ui:** propagate and stack domain restrictions down the branch ([#486](https://github.com/trebor/algebranch/issues/486)) ([#490](https://github.com/trebor/algebranch/issues/490)) ([9459712](https://github.com/trebor/algebranch/commit/9459712414cd220bc404c2a4914d4cb0ae12b452))
* **ui:** refactor left sidebar into Learn & Practice three-pillar architecture ([#550](https://github.com/trebor/algebranch/issues/550)) ([#551](https://github.com/trebor/algebranch/issues/551)) ([02473f2](https://github.com/trebor/algebranch/commit/02473f2f9bd16c635de524b34e70df42ef4f3f03))
* **ui:** sharpen active-path contrast in the history tree ([#485](https://github.com/trebor/algebranch/issues/485)) ([#495](https://github.com/trebor/algebranch/issues/495)) ([40ff521](https://github.com/trebor/algebranch/commit/40ff521eba5170124f3776a96939b14af26a5417))
* **ui:** show keyboard-shortcut keycaps in the overflow menu ([#469](https://github.com/trebor/algebranch/issues/469)) ([9f09046](https://github.com/trebor/algebranch/commit/9f09046d7c0a484d87a955fee6dacf62f74dd4aa))
* **ui:** stall-signal instrumentation for hint-ladder ([#497](https://github.com/trebor/algebranch/issues/497)) ([45fd52d](https://github.com/trebor/algebranch/commit/45fd52d036ef597d1cf083f3cec1b9e08853953e))
* **ui:** stall-signal instrumentation for hint-ladder ([#497](https://github.com/trebor/algebranch/issues/497)) ([#541](https://github.com/trebor/algebranch/issues/541)) ([45fd52d](https://github.com/trebor/algebranch/commit/45fd52d036ef597d1cf083f3cec1b9e08853953e))
* **ui:** submittable worked-solution export, unified with equation export ([#130](https://github.com/trebor/algebranch/issues/130)) ([#479](https://github.com/trebor/algebranch/issues/479)) ([346d6f7](https://github.com/trebor/algebranch/commit/346d6f73bc6949130f3359364bc1751eb993b63e))
* **ui:** teacher answer-key affordances — blanked worksheet and reveal ([#476](https://github.com/trebor/algebranch/issues/476)) ([#537](https://github.com/trebor/algebranch/issues/537)) ([c85e830](https://github.com/trebor/algebranch/commit/c85e830f7c5bca94ba0dfe2b1a2f240fb9761bd8))
* **ui:** touch long-press preview for chooser option rows ([#457](https://github.com/trebor/algebranch/issues/457)) ([#460](https://github.com/trebor/algebranch/issues/460)) ([27d387a](https://github.com/trebor/algebranch/commit/27d387a9bb0dd6fb4307e341370d58526f1597e2))
* **ui:** unify handle interaction — hover informs, click commits ([#456](https://github.com/trebor/algebranch/issues/456)) ([#458](https://github.com/trebor/algebranch/issues/458)) ([09a08c7](https://github.com/trebor/algebranch/commit/09a08c7a77a020ec7e2ec27acd8fff7a632c0098))


### Bug Fixes

* **analytics:** resolve GA consent race condition ([#532](https://github.com/trebor/algebranch/issues/532)) ([04dcd7f](https://github.com/trebor/algebranch/commit/04dcd7f1891c829fce6e3a9b748472f5a5e01bf7))
* **math-engine:** describe fraction-numerator transposition as a reciprocal move ([#491](https://github.com/trebor/algebranch/issues/491)) ([#492](https://github.com/trebor/algebranch/issues/492)) ([fa751c4](https://github.com/trebor/algebranch/commit/fa751c477f2bfc68a40478b4dfb0a5f236f6f465))
* **math-engine:** file power-unfolding under Rewrite, not Expand ([#466](https://github.com/trebor/algebranch/issues/466)) ([#468](https://github.com/trebor/algebranch/issues/468)) ([1daea4b](https://github.com/trebor/algebranch/commit/1daea4be3adaadafe31c6c046f989d855fe595e0))
* **math-engine:** fold a product of two negatives independent of inner complexity ([#465](https://github.com/trebor/algebranch/issues/465)) ([07f94d7](https://github.com/trebor/algebranch/commit/07f94d75cdfe78b3ef04d8b30e87b61cf288588d))
* **math-engine:** prevent decimal folding from blocking exact simplifications ([#534](https://github.com/trebor/algebranch/issues/534)) ([#536](https://github.com/trebor/algebranch/issues/536)) ([3186929](https://github.com/trebor/algebranch/commit/31869295e04f9cdbb8df66e0c388d4d39386a4c8))
* **math-engine:** stop ensureNodeIds re-minting a preserved node id ([#462](https://github.com/trebor/algebranch/issues/462)) ([#463](https://github.com/trebor/algebranch/issues/463)) ([f4d74e6](https://github.com/trebor/algebranch/commit/f4d74e6023ec62c43640b6ad730171efe27823d2))
* **math-engine:** suppress factor-onto-own-multiplier dead-end selectable nodes ([#475](https://github.com/trebor/algebranch/issues/475)) ([33a26b9](https://github.com/trebor/algebranch/commit/33a26b9221e138b560449d88569389451b3c8b7f))
* **ui:** concise transition-tooltip titles with uniform before → after ([#471](https://github.com/trebor/algebranch/issues/471)) ([9348bcb](https://github.com/trebor/algebranch/commit/9348bcbc9b5aa59095ff873b5c3ef3482f974577))
* **ui:** deduplicate equation selection from equation library ([#545](https://github.com/trebor/algebranch/issues/545)) ([c8053af](https://github.com/trebor/algebranch/commit/c8053af9c577d1f72da7ab2eb34046a124fbb803))
* **ui:** describe within-a-side moves as "Rearrange", not bare "Move" ([#512](https://github.com/trebor/algebranch/issues/512)) ([#527](https://github.com/trebor/algebranch/issues/527)) ([4c14fdd](https://github.com/trebor/algebranch/commit/4c14fdd787c76968eb2704860e876669f0ce9463))
* **ui:** show pulsing skeleton and fade-in history tree on load ([#474](https://github.com/trebor/algebranch/issues/474)) ([a73260e](https://github.com/trebor/algebranch/commit/a73260e7f2b868a703f0662a20ca9bce917e11f0))


### Performance Improvements

* **ui:** async math scan via web worker ([#437](https://github.com/trebor/algebranch/issues/437)) ([#530](https://github.com/trebor/algebranch/issues/530)) ([be3d6f2](https://github.com/trebor/algebranch/commit/be3d6f2041aee5b825d5285f20383dde2cc10612))

## [1.4.0](https://github.com/trebor/algebranch/compare/v1.3.1...v1.4.0) (2026-07-07)


### Features

* **math-engine:** absolute value |x| operator ([#179](https://github.com/trebor/algebranch/issues/179)) ([#411](https://github.com/trebor/algebranch/issues/411)) ([b616c43](https://github.com/trebor/algebranch/commit/b616c43901fa1ee8f4c9e07372892299ff44bb58))
* **math-engine:** flag division-by-zero subtrees as undefined ([#413](https://github.com/trebor/algebranch/issues/413)) ([#417](https://github.com/trebor/algebranch/issues/417)) ([0a4de2d](https://github.com/trebor/algebranch/commit/0a4de2d95043df64dbe3fe68ccccc70212b14443))
* **math-engine:** freeze all moves on a division-by-zero equation ([#419](https://github.com/trebor/algebranch/issues/419)) ([#420](https://github.com/trebor/algebranch/issues/420)) ([0e4f93e](https://github.com/trebor/algebranch/commit/0e4f93ee8c6d1e4b7c2909e3198ecebffee2df27))
* **math-engine:** support multivariate GCF factoring ([#428](https://github.com/trebor/algebranch/issues/428)) ([#438](https://github.com/trebor/algebranch/issues/438)) ([c352d53](https://github.com/trebor/algebranch/commit/c352d53c64d9bae51fd820f6e2066f1041030fea))
* **math-engine:** suppress no-op offers and fix cross-equals move/label mismatch ([#367](https://github.com/trebor/algebranch/issues/367)) ([#433](https://github.com/trebor/algebranch/issues/433)) ([398cf66](https://github.com/trebor/algebranch/commit/398cf66500b236895f108e7c95673523f7773a04))
* smart math input parsing (LaTeX / Unicode / SymPy) ([#401](https://github.com/trebor/algebranch/issues/401)) ([610c7f4](https://github.com/trebor/algebranch/commit/610c7f494d2b588e686cc6d0f86dfd7980fcc1ad))
* suppress generic simplify when specific reductions are available ([#421](https://github.com/trebor/algebranch/issues/421)) ([#429](https://github.com/trebor/algebranch/issues/429)) ([6050368](https://github.com/trebor/algebranch/commit/605036887e14edf8156f9bbf4de345f2f47e2e23))
* suppress Split Fraction option for 1/x and rename rules ([#432](https://github.com/trebor/algebranch/issues/432)) ([87579b9](https://github.com/trebor/algebranch/commit/87579b9fa15239966f39a869be6d14b5be69a4c5))
* **ui:** exact-preferred decimal default; center equals menu on narrow screens ([#454](https://github.com/trebor/algebranch/issues/454)) ([2ee7d30](https://github.com/trebor/algebranch/commit/2ee7d303a91fd6560bb1cd328eadc58b16771971)), closes [#363](https://github.com/trebor/algebranch/issues/363) [#392](https://github.com/trebor/algebranch/issues/392)
* **ui:** explain and place large-share-link advice in the share menu ([#405](https://github.com/trebor/algebranch/issues/405)) ([#446](https://github.com/trebor/algebranch/issues/446)) ([72c80df](https://github.com/trebor/algebranch/commit/72c80df240520251268d345b3a00eb9039d772ca))
* **ui:** five-handle taxonomy — Simplify · Expand · Factor · Rewrite · Substitute ([#427](https://github.com/trebor/algebranch/issues/427)) ([#431](https://github.com/trebor/algebranch/issues/431)) ([cd95dc6](https://github.com/trebor/algebranch/commit/cd95dc66e83e4a0c3f41dc5cb483d57f2147f7e0))
* **ui:** flag division-by-zero subtrees with a dead-end warning ([#416](https://github.com/trebor/algebranch/issues/416)) ([#422](https://github.com/trebor/algebranch/issues/422)) ([a171c5d](https://github.com/trebor/algebranch/commit/a171c5d5c319e5bab9900e417adf6cc8753ecb79))
* **ui:** path-only share + link-size guidance in the share menu ([#439](https://github.com/trebor/algebranch/issues/439)) ([#443](https://github.com/trebor/algebranch/issues/443)) ([61783fd](https://github.com/trebor/algebranch/commit/61783fd4adf62e62c1add9aa6613344b90116d41))
* **ui:** pre-publish visual/UX cleanups ([#449](https://github.com/trebor/algebranch/issues/449)) ([#450](https://github.com/trebor/algebranch/issues/450)) ([ff2760b](https://github.com/trebor/algebranch/commit/ff2760beea6e7885cabd955784c22944a54d94f1))
* **ui:** remove stack counts from handles ([#435](https://github.com/trebor/algebranch/issues/435)) ([cdced4c](https://github.com/trebor/algebranch/commit/cdced4c56fd9e4e292772991529e6192d800269c))
* **ui:** render history card labels as display-ready Unicode ([#412](https://github.com/trebor/algebranch/issues/412)) ([89a44fd](https://github.com/trebor/algebranch/commit/89a44fde1453feaee53d116044bd337d7dd1eae7)), closes [#408](https://github.com/trebor/algebranch/issues/408)
* **ui:** replay-encode ?ws= share links to slash length ([#403](https://github.com/trebor/algebranch/issues/403)) ([#404](https://github.com/trebor/algebranch/issues/404)) ([678c659](https://github.com/trebor/algebranch/commit/678c659c3fe4c1e4737492b40eddda7b27edf6ea))
* **ui:** unified copy / paste / share model ([#440](https://github.com/trebor/algebranch/issues/440)) ([#444](https://github.com/trebor/algebranch/issues/444)) ([646f4fb](https://github.com/trebor/algebranch/commit/646f4fb14a2d4940423eb0f38294d933ae2b5327))


### Bug Fixes

* **history-tree:** make the handle family the single source of truth for edge badges ([#436](https://github.com/trebor/algebranch/issues/436)) ([7352136](https://github.com/trebor/algebranch/commit/73521367f265f953825f25eb56cac56b5f6d99f6))
* **math-engine:** describe entire-side transposition as subtraction ([#426](https://github.com/trebor/algebranch/issues/426)) ([90eb699](https://github.com/trebor/algebranch/commit/90eb699ee8e88b85251c6bd555b8643c2cdca9cf))
* **math-engine:** guard tryFactor against complex products to prevent mathjs rationalize hang ([#406](https://github.com/trebor/algebranch/issues/406)) ([6d3dcbf](https://github.com/trebor/algebranch/commit/6d3dcbfd9715d227d01fb805303158f79692330e))
* **math-engine:** stop offering invalid x/0 -&gt; 0 simplification ([#333](https://github.com/trebor/algebranch/issues/333)) ([#414](https://github.com/trebor/algebranch/issues/414)) ([86dafe9](https://github.com/trebor/algebranch/commit/86dafe9b970dd8a435aba4ab21b3a6aae54f7bb2))
* **math-engine:** support simplifying -y - y to -(2 * y) and 2 * -y ([#441](https://github.com/trebor/algebranch/issues/441)) ([#442](https://github.com/trebor/algebranch/issues/442)) ([0f99324](https://github.com/trebor/algebranch/commit/0f99324c6cf155af14a16cf3568765983dcc2aaa))
* **math-engine:** suppress de-factoring "Factor out x" on product roots ([#424](https://github.com/trebor/algebranch/issues/424)) ([#430](https://github.com/trebor/algebranch/issues/430)) ([867728a](https://github.com/trebor/algebranch/commit/867728a43533d215d2471dd30a81f8d5ec4bf11f))
* **math-engine:** uniquify reducible-option preview node ids ([#400](https://github.com/trebor/algebranch/issues/400)) ([#415](https://github.com/trebor/algebranch/issues/415)) ([8fb8922](https://github.com/trebor/algebranch/commit/8fb8922466f0c5e2dfe449e64acedf463531b02b))
* precedence-paren rendering ([#410](https://github.com/trebor/algebranch/issues/410)) + nthRoot registration ([#425](https://github.com/trebor/algebranch/issues/425)) ([3adf672](https://github.com/trebor/algebranch/commit/3adf67298de8a5dc39a5201e3b36c1c12a8da3ad))
* **ui:** touch-aware tooltip peek — tap acts, long-press reads ([#388](https://github.com/trebor/algebranch/issues/388)) ([#455](https://github.com/trebor/algebranch/issues/455)) ([974bd7d](https://github.com/trebor/algebranch/commit/974bd7d7f089d8e24d2245030f841fd4bacaab46))

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
