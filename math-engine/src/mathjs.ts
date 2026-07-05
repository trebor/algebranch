// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Custom, tree-shakeable mathjs instance (#174).
//
// Importing any runtime value from the `mathjs` main entry pulls in the full
// "embedded" instance (every function mathjs ships, ~485 KB gzip), because that
// entry eagerly constructs it as a module side effect. To keep the client
// bundle small we instead import only `create` plus the dependency bundles for
// the functions the engine actually calls, and build our own instance. The rest
// of the codebase imports `mjs` / `fractionMath` from here for runtime values,
// and uses `import type * as math from 'mathjs'` for (erased) type references.
//
// `create` is typed to return a full `MathJsInstance`, so callers get complete
// typings; only the dependencies wired below exist at runtime, so calling a
// function that isn't listed here would throw — the contract test in
// `tests/mathjs-instance.test.ts` pins the surface we rely on.
import {
  create,
  parseDependencies,
  evaluateDependencies,
  piDependencies,
  eDependencies,
  simplifyDependencies,
  rationalizeDependencies,
  absDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  compareDependencies,
  fractionDependencies,
  FractionDependencies,
  sqrtDependencies,
  nthRootDependencies,
  sinDependencies,
  cosDependencies,
  tanDependencies,
  cscDependencies,
  secDependencies,
  cotDependencies,
  logDependencies,
  ConstantNodeDependencies,
  OperatorNodeDependencies,
  SymbolNodeDependencies,
  FunctionNodeDependencies,
  ParenthesisNodeDependencies,
} from 'mathjs';

const dependencies = {
  ...parseDependencies,
  ...evaluateDependencies,
  ...piDependencies,
  ...eDependencies,
  ...simplifyDependencies,
  ...rationalizeDependencies,
  ...absDependencies,
  ...addDependencies,
  ...subtractDependencies,
  ...multiplyDependencies,
  ...divideDependencies,
  ...powDependencies,
  ...unaryMinusDependencies,
  ...compareDependencies,
  ...fractionDependencies,
  ...FractionDependencies,
  ...sqrtDependencies,
  ...nthRootDependencies,
  ...sinDependencies,
  ...cosDependencies,
  ...tanDependencies,
  ...cscDependencies,
  ...secDependencies,
  ...cotDependencies,
  ...logDependencies,
  ...ConstantNodeDependencies,
  ...OperatorNodeDependencies,
  ...SymbolNodeDependencies,
  ...FunctionNodeDependencies,
  ...ParenthesisNodeDependencies,
};

/** The engine-wide mathjs instance (default number type). */
export const mjs = create(dependencies);

/**
 * Sibling instance configured to produce exact `Fraction` values, used when
 * evaluating constant subtrees so e.g. `2/12` collapses to `1/6` rather than a
 * float. Shares the same dependency set as {@link mjs}.
 */
export const fractionMath = create(dependencies, { number: 'Fraction' });

/**
 * The imaginary-unit token (#105). It is the distinct Unicode codepoint
 * U+2148 `ⅈ` ("DOUBLE-STRUCK ITALIC SMALL I"), deliberately NOT the ASCII
 * letter `i` — that stays free as an ordinary variable (counters, indices, the
 * summation index of #182). mathjs's default `parse.isAlpha` already accepts
 * this codepoint, so `parse('ⅈ')` yields a `SymbolNode` named `ⅈ` while `i`
 * stays a variable; no `isAlpha` extension is needed. Disambiguation is by
 * input channel (a palette button inserts the glyph), never by spelling.
 *
 * Caveat handled elsewhere: Unicode NFKC normalization collapses `ⅈ` → ASCII
 * `i`, which would erase the distinction — so no `.normalize('NFKC')` may run on
 * the equation string in the input / share-link pipeline.
 */
export const IMAGINARY_UNIT = 'ⅈ';

/**
 * The value of the imaginary unit, the Complex `0 + 1i`. Obtained from the
 * bundled `sqrt` (mathjs pulls the `Complex` data type in transitively via the
 * `sqrt`/`pow` dependencies), so no explicit `complexDependencies` wiring is
 * required. Used by the point evaluator to resolve the `ⅈ` symbol.
 */
export const IMAGINARY_VALUE = mjs.sqrt(-1);

/**
 * Whether a symbol name refers to a built-in mathematical constant rather than a
 * free variable. Centralizes the `pi` / `e` / imaginary-unit special-casing that
 * the variable-collection and constant-subtree sites share, so the imaginary
 * unit is uniformly excluded from the solve variables. (#105)
 */
export const isReservedConstantName = (name: string): boolean =>
  name === 'pi' || name === 'e' || name === IMAGINARY_UNIT;
