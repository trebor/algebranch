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
