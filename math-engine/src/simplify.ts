// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs, fractionMath, isReservedConstantName, IMAGINARY_UNIT } from './mathjs';
import { Equation, getAllPaths, removeNodeAtPath, getNodeByPath, replaceNodeAtPath, ensureNodeIds } from './tree';
import { areEquationsEquivalent, areExpressionsValueEqual, evaluatePoint, getFunctionName, getQuadraticFormulaSolutions, getQuadraticStandardForm, getVariables, tryExtractQuadraticExpr } from './validator';
import { HIGH_SCHOOL_IDENTITIES } from './rules';
import { matchPattern, instantiatePattern, tryExpressAsPower, tryExpressAsPowerOptions } from './matcher';
import { tryFactor } from './factor';

const SPLIT_NUMERATOR_SUPPRESS_VALUE = 1;


/**
 * Counts the total number of nodes in a mathematical syntax tree.
 */
const countNodes = (node: math.MathNode): number => {
  let count = 0;
  node.traverse((n) => {
    if (n.type !== 'ParenthesisNode') {
      count++;
    }
  });
  return count;
};

/**
 * Counts the total number of SymbolNode instances in a mathematical syntax tree.
 */
const countSymbolNodes = (node: math.MathNode): number => {
  let count = 0;
  node.traverse((n) => {
    if (n.type === 'SymbolNode') {
      count++;
    }
  });
  return count;
};


/**
 * Tries to remove a single node at path 'p' from the equation.
 * Returns the new equation if successful, otherwise null.
 */
export const trySingleRemoval = (eq: Equation, p: string): Equation | null => {
  try {
    const { newEquation } = removeNodeAtPath(eq, p);
    return newEquation;
  } catch {
    return null;
  }
};

/**
 * Tries to remove a pair of nodes at paths 'p1' and 'p2'.
 * Sorts them by depth (deeper first) to ensure path indices remain valid.
 * Returns the new equation if successful, otherwise null.
 */
export const tryDoubleRemoval = (eq: Equation, p1: string, p2: string): Equation | null => {
  try {
    // Sort paths descending by length (number of slashes) so we remove deeper nodes first
    const sortedPaths = [p1, p2].sort((a, b) => b.split('/').length - a.split('/').length);

    // Remove the first (deeper) node
    const res1 = removeNodeAtPath(eq, sortedPaths[0]);

    // Check if the second path is still valid in the new tree
    const currentPaths = getAllPaths(res1.newEquation);
    if (currentPaths.includes(sortedPaths[1])) {
      const res2 = removeNodeAtPath(res1.newEquation, sortedPaths[1]);
      return res2.newEquation;
    }
  } catch {
    // Graceful fallback for any traversal misalignment
  }
  return null;
};

/**
 * Checks recursively if a mathjs node is a subtree containing only constants (no variables).
 */
export const isConstantSubtree = (node: math.MathNode): boolean => {
  if (node.type === 'ConstantNode') return true;
  if (node.type === 'SymbolNode') {
    const name = (node as math.SymbolNode).name;
    return isReservedConstantName(name);
  }
  if (node.type === 'ParenthesisNode') {
    return isConstantSubtree((node as math.ParenthesisNode).content);
  }
  if (node.type === 'OperatorNode') {
    return (node as math.OperatorNode).args.every(isConstantSubtree);
  }
  if (node.type === 'FunctionNode') {
    // Only check args, NOT the function name reference (which is a SymbolNode like 'sqrt')
    return (node as math.FunctionNode).args.every(isConstantSubtree);
  }
  return false;
};

const mathFraction = fractionMath;

/**
 * Checks if a mathematical node contains any constant node with a decimal point.
 */
const hasDecimalConstant = (node: math.MathNode): boolean => {
  let hasDecimal = false;
  node.traverse((n) => {
    if (n.type === 'ConstantNode') {
      const valStr = String((n as math.ConstantNode).value);
      if (valStr.includes('.')) {
        hasDecimal = true;
      }
    }
  });
  return hasDecimal;
};

/**
 * Evaluates a constant subtree to its simplified form, preserving fractions (e.g. 2/12 -> 1/6)
 * instead of converting to decimal float.
 */
export const evaluateConstantSubtree = (node: math.MathNode): math.MathNode | null => {
  if (node.type === 'ConstantNode') return null;
  if (!isConstantSubtree(node)) return null;

  // Try fraction evaluation first if it doesn't contain decimals
  if (!hasDecimalConstant(node)) {
    try {
      const val = mathFraction.evaluate(node.toString());
      if (val && val.constructor?.name === 'Fraction') {
        const s = Number(val.s);
        const n = Number(val.n);
        const d = Number(val.d);

        if (d === 1) {
          return new mjs.ConstantNode(s * n);
        } else {
          return new mjs.OperatorNode('/', 'divide', [
            new mjs.ConstantNode(s * n),
            new mjs.ConstantNode(d)
          ]);
        }
      }
    } catch {
      // Ignore and fall through to standard numeric evaluation
    }
  }

  // Fall back to standard numeric evaluation
  try {
    const val = node.compile().evaluate();
    let numVal: number | null = null;
    if (typeof val === 'number') {
      numVal = val;
    } else if (val && typeof val === 'object' && 'toNumber' in val) {
      numVal = (val as unknown as { toNumber: () => number }).toNumber();
    } else {
      const parsed = parseFloat(val?.toString());
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    }
    if (numVal !== null && !isNaN(numVal) && isFinite(numVal)) {
      return new mjs.ConstantNode(numVal);
    }
  } catch {
    // ignore
  }

  return null;
};

const unwrapParens = (n: math.MathNode): math.MathNode => {
  while (n.type === 'ParenthesisNode') {
    n = (n as math.ParenthesisNode).content;
  }
  return n;
};

/**
 * Identifies a root of a matching power and reports its base and parity.
 *  - sqrt(e^2) / nthRoot(e^2) -> { base: e, even: true }   (= |e|, needs ±)
 *  - nthRoot(e^n, n)          -> { base: e, even: n % 2 === 0 }
 * Odd roots are sign-safe (cube root etc.); even roots lose the sign and so are
 * surfaced as a ± branch by getReducibleOptions rather than collapsed silently.
 */
export const analyzeRootOfPower = (
  node: math.MathNode,
): { base: math.MathNode; even: boolean } | null => {
  if (node.type !== 'FunctionNode') return null;
  const funcNode = node as math.FunctionNode;
  const nameStr = getFunctionName(funcNode);

  const matchPow = (arg: math.MathNode, expectedDegree?: math.MathNode): math.MathNode | null => {
    const inner = unwrapParens(arg);
    if (inner.type !== 'OperatorNode') return null;
    const opNode = inner as math.OperatorNode;
    if (opNode.op !== '^' || opNode.args.length !== 2) return null;
    const exponent = unwrapParens(opNode.args[1]);
    if (expectedDegree === undefined) {
      return exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2
        ? opNode.args[0]
        : null;
    }
    return exponent.toString() === expectedDegree.toString() ? opNode.args[0] : null;
  };

  if (nameStr === 'sqrt' && funcNode.args.length === 1) {
    const base = matchPow(funcNode.args[0]);
    return base ? { base, even: true } : null;
  }

  if (nameStr === 'nthRoot') {
    if (funcNode.args.length === 1) {
      const base = matchPow(funcNode.args[0]);
      return base ? { base, even: true } : null; // implicit degree 2
    }
    if (funcNode.args.length === 2) {
      const degree = unwrapParens(funcNode.args[1]);
      const base = matchPow(funcNode.args[0], degree);
      if (!base) return null;
      const even = degree.type === 'ConstantNode' && Number((degree as math.ConstantNode).value) % 2 === 0;
      return { base, even };
    }
  }

  return null;
};

/**
 * Simplify a root of a matching power (e.g. nthRoot(x^3, 3) -> x). Only ODD roots
 * are collapsed here, since they are sign-safe. EVEN roots (sqrt(x^2) = |x|) are
 * intentionally NOT collapsed — they are offered as a ± branch instead so the
 * negative solution is never silently dropped (#45).
 */
export const trySimplifyRootOfPower = (node: math.MathNode): math.MathNode | null => {
  const analysis = analyzeRootOfPower(node);
  return analysis && !analysis.even ? analysis.base : null;
};

/**
 * Helper to identify and simplify powers of matching roots (e.g. (sqrt(x))^2 -> x, (nthRoot(x, n))^n -> x).
 */
export const trySimplifyPowerOfRoot = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  if (opNode.op !== '^' || opNode.args.length !== 2) {
    return null;
  }

  let base = opNode.args[0];
  let exponent = opNode.args[1];

  // Unwrap parentheses
  while (base.type === 'ParenthesisNode') {
    base = (base as math.ParenthesisNode).content;
  }
  while (exponent.type === 'ParenthesisNode') {
    exponent = (exponent as math.ParenthesisNode).content;
  }

  if (base.type !== 'FunctionNode') {
    return null;
  }
  const baseFunc = base as math.FunctionNode;
  const nameStr = getFunctionName(baseFunc);

  if (nameStr === 'sqrt') {
    if (baseFunc.args.length === 1) {
      if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
        return baseFunc.args[0];
      }
    }
  }

  if (nameStr === 'nthRoot') {
    if (baseFunc.args.length === 1) {
      // Default degree is 2 for nthRoot with 1 argument (equivalent to square root)
      if (exponent.type === 'ConstantNode' && Number((exponent as math.ConstantNode).value) === 2) {
        return baseFunc.args[0];
      }
    } else if (baseFunc.args.length === 2) {
      let rootDegree = baseFunc.args[1];
      while (rootDegree.type === 'ParenthesisNode') {
        rootDegree = (rootDegree as math.ParenthesisNode).content;
      }
      if (exponent.toString() === rootDegree.toString()) {
        return baseFunc.args[0];
      }
    }
  }

  return null;
};

/**
 * Simplify a numeric radical by extracting the largest perfect n-th-power factor
 * from an integer radicand, keeping the result exact (never decimalised):
 *   sqrt(8)  -> 2 * sqrt(2)      sqrt(12)      -> 2 * sqrt(3)
 *   sqrt(18) -> 3 * sqrt(2)      nthRoot(16,3) -> 2 * nthRoot(2, 3)
 * Returns null when there is nothing to pull out — the radicand is already in
 * simplest form (sqrt(2), sqrt(6)), is not a positive integer ≥ 2, or is itself
 * a perfect power (sqrt(4) -> 2), which is left to constant folding so the two
 * paths don't both offer a move on the same node (#66).
 */
export const trySimplifyRadical = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'FunctionNode') return null;
  const funcNode = node as math.FunctionNode;
  const nameStr = getFunctionName(funcNode);

  // Resolve the radicand and the root degree (sqrt and 1-arg nthRoot are degree 2).
  let radicandNode: math.MathNode;
  let degree: number;
  if (nameStr === 'sqrt' && funcNode.args.length === 1) {
    radicandNode = funcNode.args[0];
    degree = 2;
  } else if (nameStr === 'nthRoot' && funcNode.args.length === 1) {
    radicandNode = funcNode.args[0];
    degree = 2;
  } else if (nameStr === 'nthRoot' && funcNode.args.length === 2) {
    radicandNode = funcNode.args[0];
    const degNode = unwrapParens(funcNode.args[1]);
    if (degNode.type !== 'ConstantNode') return null;
    degree = Number((degNode as math.ConstantNode).value);
  } else {
    return null;
  }

  if (!Number.isInteger(degree) || degree < 2) return null;

  const radicand = unwrapParens(radicandNode);
  if (radicand.type !== 'ConstantNode') return null;
  const k = (radicand as math.ConstantNode).value;
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 2) return null;

  // Pull out every perfect n-th-power factor: k = coeff^degree * remaining.
  let coeff = 1;
  let remaining = k;
  for (let f = 2; Math.pow(f, degree) <= remaining; f++) {
    const fPow = Math.pow(f, degree);
    while (remaining % fPow === 0) {
      remaining /= fPow;
      coeff *= f;
    }
  }

  // coeff === 1: nothing extractable (already simplest). remaining === 1: the
  // radicand was a perfect power, so this reduces to a bare integer — leave that
  // to constant folding rather than emitting `coeff * root(1)`.
  if (coeff === 1 || remaining === 1) return null;

  const rootNode: math.MathNode =
    nameStr === 'sqrt'
      ? new mjs.FunctionNode('sqrt', [new mjs.ConstantNode(remaining)])
      : funcNode.args.length === 2
        ? new mjs.FunctionNode('nthRoot', [new mjs.ConstantNode(remaining), new mjs.ConstantNode(degree)])
        : new mjs.FunctionNode('nthRoot', [new mjs.ConstantNode(remaining)]);

  return new mjs.OperatorNode('*', 'multiply', [new mjs.ConstantNode(coeff), rootNode]);
};

/**
 * The "extend to ℂ" rewrite (#105): a square root of a negative constant has no
 * real value, so resolve it to imaginary form on the principal branch,
 * `√−A → √A · ⅈ` (for A > 0). The residual real radical `√A` is left intact so
 * the existing "Simplify Radical" / "Simplify" steps can reduce it in a
 * following, separately-inspectable move (`√−4 → √4·ⅈ → 2·ⅈ`).
 *
 * Returns null unless the node is `sqrt(<negative constant>)` — a bare negative
 * ConstantNode or a unary-minus of a positive constant subtree. A symbolic
 * radicand (`√−x`) is deliberately excluded: its sign isn't known, so there is
 * no unconditional imaginary form to offer.
 */
export const tryExtendToComplex = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'FunctionNode') return null;
  const fn = node as math.FunctionNode;
  if (getFunctionName(fn) !== 'sqrt' || fn.args.length !== 1) return null;

  const radicand = unwrapParens(fn.args[0]);

  let posRadicand: math.MathNode | null = null;
  if (radicand.type === 'ConstantNode') {
    const v = Number((radicand as math.ConstantNode).value);
    if (v < 0) posRadicand = new mjs.ConstantNode(-v);
  } else if (radicand.type === 'OperatorNode') {
    const op = radicand as math.OperatorNode;
    if (op.isUnary() && op.op === '-' && isConstantSubtree(op.args[0])) {
      const innerVal = Number(op.args[0].compile().evaluate());
      if (Number.isFinite(innerVal) && innerVal > 0) posRadicand = op.args[0];
    }
  }
  if (!posRadicand) return null;

  // √−1 collapses straight to ⅈ — the √1 factor would be a pure-noise
  // intermediate. Any other radicand keeps its residual real √A for a
  // following Simplify step (√−4 → √4·ⅈ → 2·ⅈ).
  const posVal = Number(posRadicand.compile().evaluate());
  if (posVal === 1) return new mjs.SymbolNode(IMAGINARY_UNIT);

  return new mjs.OperatorNode('*', 'multiply', [
    new mjs.FunctionNode('sqrt', [posRadicand]),
    new mjs.SymbolNode(IMAGINARY_UNIT),
  ]);
};

/** Count occurrences of the imaginary-unit symbol in a subtree. */
const countImaginaryUnits = (node: math.MathNode): number => {
  let n = 0;
  node.traverse((child) => {
    if (child.type === 'SymbolNode' && (child as math.SymbolNode).name === IMAGINARY_UNIT) n++;
  });
  return n;
};


// Snap a float to the nearest integer when it is within tolerance — folded
// complex arithmetic on exact inputs lands on integers up to float noise.
const snapReal = (x: number): number => {
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-9 ? r : x;
};

// Build the `b · ⅈ` factor for a positive coefficient, eliding the unit
// coefficient (b === 1 → bare ⅈ).
const imaginaryTerm = (b: number): math.MathNode =>
  b === 1
    ? new mjs.SymbolNode(IMAGINARY_UNIT)
    : new mjs.OperatorNode('*', 'multiply', [new mjs.ConstantNode(b), new mjs.SymbolNode(IMAGINARY_UNIT)]);

/**
 * Render a computed complex (or real) value as an AST node in `a + b·ⅈ` standard
 * form (#105): a pure real is a bare constant; a pure imaginary is `b·ⅈ` (or ⅈ /
 * −ⅈ); a mixed value reads `a + b·ⅈ` or `a − b·ⅈ` with the sign folded into a
 * subtraction so it prints conventionally.
 */
export const complexToNode = (value: number | { re: number; im: number; isComplex?: boolean }): math.MathNode => {
  const re = snapReal(typeof value === 'number' ? value : value.re);
  const im = snapReal(typeof value === 'number' ? 0 : value.im);

  if (im === 0) return new mjs.ConstantNode(re);

  const imagWithSign = (b: number): math.MathNode =>
    b < 0
      ? new mjs.OperatorNode('-', 'unaryMinus', [imaginaryTerm(-b)])
      : imaginaryTerm(b);

  if (re === 0) return imagWithSign(im);

  const reNode = new mjs.ConstantNode(re);
  return im < 0
    ? new mjs.OperatorNode('-', 'subtract', [reNode, imaginaryTerm(-im)])
    : new mjs.OperatorNode('+', 'add', [reNode, imaginaryTerm(im)]);
};

const cleanNodeStr = (node: math.MathNode): string => node.toString().replace(/[\s()]/g, '');

/**
 * Fold a constant subtree that contains ⅈ into `a + b·ⅈ` standard form — the
 * minimal complex-arithmetic simplification (ⅈ² → −1, power cycling, combining
 * like imaginary terms). Returns the folded node plus the label the move should
 * carry, or null when nothing changes.
 *
 * The label tracks the exact/decimal split so the folded move honors the same
 * gates a real simplification would (#105):
 *  - Integer result (ⅈ·3·ⅈ → −3, 2ⅈ + 3ⅈ → 5ⅈ) → an exact `Simplify`. Fires only
 *    on a genuine collapse (fewer ⅈ, or a structurally smaller tree for power
 *    cycling like ⅈ³ → −ⅈ), so it never fires as a bare commutative reorder
 *    (ⅈ·3 → 3·ⅈ) or on an already-standard term.
 *  - Non-integer result (5·ⅈ/3 → 1.666…·ⅈ) → `Evaluate to Decimal`, so it is
 *    gated exactly like the real decimal evaluation and never rides in under
 *    `Simplify`. Fires whenever the decimal form differs from the input.
 *
 * Returns null for a variable-bearing or ⅈ-free node (the latter is left to the
 * ordinary real simplifier).
 */
export const trySimplifyComplexConstant = (
  node: math.MathNode,
): { node: math.MathNode; label: 'Simplify' | 'Evaluate to Decimal' } | null => {
  if (countImaginaryUnits(node) === 0) return null;
  if (!isConstantSubtree(node)) return null;

  let value: number | { re: number; im: number; isComplex?: boolean };
  try {
    value = evaluatePoint(node, {});
  } catch {
    return null;
  }
  const re = snapReal(typeof value === 'number' ? value : value.re);
  const im = snapReal(typeof value === 'number' ? 0 : value.im);
  if (!Number.isFinite(re) || !Number.isFinite(im) || Number.isNaN(re) || Number.isNaN(im)) return null;

  const out = complexToNode(value);
  const isExact = Number.isInteger(re) && Number.isInteger(im);

  if (isExact) {
    const collapsesUnits = countImaginaryUnits(out) < countImaginaryUnits(node);
    const shrinks = countNodes(out) < countNodes(node);
    if (!collapsesUnits && !shrinks) return null;
    return { node: out, label: 'Simplify' };
  }

  // Decimal result: offer it as a gated "Evaluate to Decimal" whenever it
  // actually changes the expression.
  if (cleanNodeStr(out) === cleanNodeStr(node)) return null;
  return { node: out, label: 'Evaluate to Decimal' };
};

/**
 * Rationalize a complex denominator by multiplying through by its conjugate:
 *   1 / (2 + ⅈ)     -> (2 − ⅈ) / 5
 *   5 / (2 + ⅈ)     -> 2 − ⅈ           (numeric fraction reduces)
 *   1 / (2·ⅈ)       -> −ⅈ / 2
 * The denominator must be a constant subtree evaluating to a complex number
 * a + b·ⅈ with integer a, b and b ≠ 0 (a real denominator is the province of the
 * real radical rationalizer). Multiplying top and bottom by the conjugate
 * a − b·ⅈ makes the denominator the real a² + b²; the result is reduced to lowest
 * terms. Parallels tryRationalizeDenominator over ℂ (#105, #66).
 */
export const tryRationalizeComplexDenominator = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') return null;
  const opNode = node as math.OperatorNode;
  if (opNode.op !== '/' || opNode.args.length !== 2) return null;

  const numerator = opNode.args[0];
  const denominator = unwrapParens(opNode.args[1]);

  if (countImaginaryUnits(denominator) === 0 || !isConstantSubtree(denominator)) return null;

  let dval: number | { re: number; im: number; isComplex?: boolean };
  try {
    dval = evaluatePoint(denominator, {});
  } catch {
    return null;
  }
  if (typeof dval === 'number' || !dval.isComplex) return null;
  const a = snapReal(dval.re);
  const b = snapReal(dval.im);
  if (!Number.isInteger(a) || !Number.isInteger(b) || b === 0) return null;

  const denomInt = a * a + b * b; // (a + b·ⅈ)(a − b·ⅈ)

  const numInner = unwrapParens(numerator);
  if (numInner.type === 'ConstantNode' && Number.isInteger((numInner as math.ConstantNode).value)) {
    // c·(a − b·ⅈ) / (a² + b²), reduced to lowest terms.
    const c = (numInner as math.ConstantNode).value as number;
    let reNum = c * a;
    let imNum = -c * b;
    const g = gcdInt(gcdInt(reNum, imNum), denomInt) || 1;
    reNum /= g;
    imNum /= g;
    const d = denomInt / g;
    const numNode = complexToNode({ re: reNum, im: imNum });
    return d === 1 ? numNode : new mjs.OperatorNode('/', 'divide', [numNode, new mjs.ConstantNode(d)]);
  }

  // General numerator: num · (a − b·ⅈ) / (a² + b²), left unreduced.
  const conjugate = complexToNode({ re: a, im: -b });
  const numNode = new mjs.OperatorNode('*', 'multiply', [numerator, conjugate]);
  return new mjs.OperatorNode('/', 'divide', [numNode, new mjs.ConstantNode(denomInt)]);
};

/**
 * Parse a single additive term into a radical and its numeric coefficient:
 *   sqrt(2)        -> { coeff: 1,  root: sqrt(2) }
 *   3 * sqrt(2)    -> { coeff: 3,  root: sqrt(2) }
 *   nthRoot(5,3)*4 -> { coeff: 4,  root: nthRoot(5, 3) }
 * Returns null when the term is not `coeff * radical` with a single numeric
 * coefficient and a sqrt/nthRoot factor (used to combine like radicals — #66).
 */
const parseRadicalTerm = (
  node: math.MathNode,
): { coeff: number; root: math.MathNode } | null => {
  const isRadical = (n: math.MathNode): boolean => {
    if (n.type !== 'FunctionNode') return false;
    const name = getFunctionName(n as math.FunctionNode);
    return name === 'sqrt' || name === 'nthRoot';
  };

  const inner = unwrapParens(node);

  if (isRadical(inner)) {
    return { coeff: 1, root: inner };
  }

  if (inner.type === 'OperatorNode' && (inner as math.OperatorNode).op === '*') {
    const opNode = inner as math.OperatorNode;
    if (opNode.args.length !== 2) return null;
    const a = unwrapParens(opNode.args[0]);
    const b = unwrapParens(opNode.args[1]);
    if (a.type === 'ConstantNode' && isRadical(b)) {
      const c = Number((a as math.ConstantNode).value);
      return Number.isFinite(c) ? { coeff: c, root: b } : null;
    }
    if (b.type === 'ConstantNode' && isRadical(a)) {
      const c = Number((b as math.ConstantNode).value);
      return Number.isFinite(c) ? { coeff: c, root: a } : null;
    }
  }

  return null;
};

/**
 * Combine two like radical terms over a binary +/- into a single exact term,
 * keeping the irrational symbolic (never decimalised):
 *   sqrt(2) + sqrt(2)      -> 2 * sqrt(2)
 *   3 * sqrt(2) - sqrt(2)  -> 2 * sqrt(2)
 *   a*sqrt(k) + b*sqrt(k)  -> (a + b) * sqrt(k)
 * Unlike radicals (sqrt(2) + sqrt(3)) and non-radical terms return null. The
 * radicands/degrees must match exactly (compared structurally); a cancelling
 * pair collapses to 0 and a unit coefficient drops to the bare radical (#66).
 */
export const tryCombineLikeRadicals = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') return null;
  const opNode = node as math.OperatorNode;
  if ((opNode.op !== '+' && opNode.op !== '-') || opNode.args.length !== 2) return null;

  const left = parseRadicalTerm(opNode.args[0]);
  const right = parseRadicalTerm(opNode.args[1]);
  if (!left || !right) return null;

  // Like radicals share the same root (same radicand and degree).
  if (left.root.toString() !== right.root.toString()) return null;

  const coeff = opNode.op === '+' ? left.coeff + right.coeff : left.coeff - right.coeff;
  const root = left.root;

  if (coeff === 0) return new mjs.ConstantNode(0);
  if (coeff === 1) return root;
  if (coeff === -1) return new mjs.OperatorNode('-', 'unaryMinus', [root]);
  return new mjs.OperatorNode('*', 'multiply', [new mjs.ConstantNode(coeff), root]);
};

/**
 * Resolve a sqrt/nthRoot node to its integer radical form, pulling out any
 * perfect n-th-power factor so the radicand is in simplest form:
 *   sqrt(2)       -> { degree: 2, radicand: 2, extraCoeff: 1 }
 *   sqrt(8)       -> { degree: 2, radicand: 2, extraCoeff: 2 }  (= 2√2)
 *   nthRoot(2, 3) -> { degree: 3, radicand: 2, extraCoeff: 1 }
 * `extraCoeff` is the integer factored out of the radical (reuses Deliverable
 * 1's extraction — #66). Returns null when the radicand is not a positive
 * integer, or reduces to 1 (a perfect power, e.g. sqrt(4) -> 2, no radical left).
 */
const integerRadicalForm = (
  root: math.MathNode,
): { degree: number; radicand: number; extraCoeff: number } | null => {
  if (root.type !== 'FunctionNode') return null;
  const funcNode = root as math.FunctionNode;
  const nameStr = getFunctionName(funcNode);

  let radicandNode: math.MathNode;
  let degree: number;
  if (nameStr === 'sqrt' && funcNode.args.length === 1) {
    radicandNode = funcNode.args[0];
    degree = 2;
  } else if (nameStr === 'nthRoot' && funcNode.args.length === 1) {
    radicandNode = funcNode.args[0];
    degree = 2;
  } else if (nameStr === 'nthRoot' && funcNode.args.length === 2) {
    radicandNode = funcNode.args[0];
    const degNode = unwrapParens(funcNode.args[1]);
    if (degNode.type !== 'ConstantNode') return null;
    degree = Number((degNode as math.ConstantNode).value);
  } else {
    return null;
  }

  if (!Number.isInteger(degree) || degree < 2) return null;

  const radicand = unwrapParens(radicandNode);
  if (radicand.type !== 'ConstantNode') return null;
  const k = (radicand as math.ConstantNode).value;
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 2) return null;

  // Pull out every perfect n-th-power factor: k = extraCoeff^degree * remaining.
  let extraCoeff = 1;
  let remaining = k;
  for (let f = 2; Math.pow(f, degree) <= remaining; f++) {
    const fPow = Math.pow(f, degree);
    while (remaining % fPow === 0) {
      remaining /= fPow;
      extraCoeff *= f;
    }
  }

  // remaining === 1 means the radicand was a perfect power, so no irrational
  // radical survives (sqrt(4) -> 2) — leave that to constant folding.
  if (remaining === 1) return null;

  return { degree, radicand: remaining, extraCoeff };
};

/**
 * Rationalize the denominator of a fraction whose denominator is a numeric
 * radical (optionally with an integer coefficient), keeping the result exact:
 *   1 / sqrt(2)       -> sqrt(2) / 2
 *   3 / sqrt(2)       -> 3 * sqrt(2) / 2
 *   1 / (2 * sqrt(3)) -> sqrt(3) / 6
 *   2 / sqrt(2)       -> sqrt(2)          (numeric fraction reduces to 1)
 *   1 / nthRoot(2, 3) -> nthRoot(4, 3) / 2
 *   1 / sqrt(8)       -> sqrt(2) / 4      (reuses Deliverable 1's extraction)
 * Multiplies numerator and denominator by the factor that clears the radical
 * (sqrt(k) for square roots, nthRoot(k^(n-1), n) for n-th roots), then reduces
 * the resulting numeric fraction. Returns null when the denominator is not a
 * numeric radical term, or there is nothing to rationalize (#66, Deliverable 3).
 */
export const tryRationalizeDenominator = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') return null;
  const opNode = node as math.OperatorNode;
  if (opNode.op !== '/' || opNode.args.length !== 2) return null;

  const numerator = opNode.args[0];
  const denominator = opNode.args[1];

  // The denominator must be `radical` or `coeff * radical` with an integer coeff.
  const denomTerm = parseRadicalTerm(denominator);
  if (!denomTerm || !Number.isInteger(denomTerm.coeff)) return null;

  const form = integerRadicalForm(denomTerm.root);
  if (!form) return null;
  const { degree, radicand } = form;

  // Effective denominator is (coeff * extraCoeff) * root(radicand) with a
  // square-/power-free radicand; the multiplier clears that radical.
  const denomCoeff = denomTerm.coeff * form.extraCoeff;
  if (denomCoeff === 0) return null;

  // Multiplier that rationalizes: sqrt(k)·sqrt(k) = k, and
  // nthRoot(k, n)·nthRoot(k^(n-1), n) = nthRoot(k^n, n) = k.
  const multiplier: math.MathNode =
    degree === 2
      ? new mjs.FunctionNode('sqrt', [new mjs.ConstantNode(radicand)])
      : new mjs.FunctionNode('nthRoot', [
          new mjs.ConstantNode(Math.pow(radicand, degree - 1)),
          new mjs.ConstantNode(degree),
        ]);

  // After multiplying through, the denominator is the bare integer denomCoeff·k.
  const newDenomInt = denomCoeff * radicand;

  const numInner = unwrapParens(numerator);
  let numeratorNode: math.MathNode;
  let denomInt = newDenomInt;

  if (numInner.type === 'ConstantNode' && Number.isInteger((numInner as math.ConstantNode).value)) {
    // Numeric numerator: reduce the resulting integer fraction (2/√2 -> √2).
    const c = (numInner as math.ConstantNode).value as number;
    const g = gcdInt(c, newDenomInt);
    const cReduced = c / g;
    denomInt = newDenomInt / g;
    numeratorNode =
      cReduced === 1
        ? multiplier
        : cReduced === -1
          ? new mjs.OperatorNode('-', 'unaryMinus', [multiplier])
          : new mjs.OperatorNode('*', 'multiply', [new mjs.ConstantNode(cReduced), multiplier]);
  } else {
    // General numerator: multiply it by the rationalizing factor, no reduction.
    numeratorNode = new mjs.OperatorNode('*', 'multiply', [numerator, multiplier]);
  }

  if (denomInt === 1) return numeratorNode;
  return new mjs.OperatorNode('/', 'divide', [numeratorNode, new mjs.ConstantNode(denomInt)]);
};

/**
 * True when the node at `path` is the radicand (first argument) of a sqrt/nthRoot
 * function — used to suppress radicand-only suggestions (e.g. "Express as Cube"
 * on the 8 inside sqrt(8)) that misfire when the real move is the radical (#66).
 */
const isRadicandOfRoot = (eq: Equation, path: string): boolean => {
  const slash = path.lastIndexOf('/');
  if (slash < 0) return false;
  if (path.slice(slash + 1) !== '0') return false; // only the radicand (args[0])
  try {
    const parent = getNodeByPath(eq, path.slice(0, slash));
    if (parent.type !== 'FunctionNode') return false;
    const name = getFunctionName(parent as math.FunctionNode);
    return name === 'sqrt' || name === 'nthRoot';
  } catch {
    return false;
  }
};

/** Build a node for an exact rational, as p, p / q, or -(…) for negatives. */
const fractionToNode = (frac: math.Fraction): math.MathNode => {
  const n = Number(frac.n); // mathjs Fraction stores sign separately in `s`
  const d = Number(frac.d);
  const magnitude: math.MathNode =
    d === 1
      ? new mjs.ConstantNode(n)
      : new mjs.OperatorNode('/', 'divide', [new mjs.ConstantNode(n), new mjs.ConstantNode(d)]);
  return frac.s < 0 ? new mjs.OperatorNode('-', 'unaryMinus', [magnitude]) : magnitude;
};

/**
 * Complete the square on a quadratic expression a·v² + b·v + c (in one variable
 * v), rewriting it to vertex form a·(v + b/(2a))² + (c − b²/(4a)). Keeps the
 * results as exact fractions — never decimals — consistent with #66/#9. Returns
 * null when the node isn't a numeric quadratic in a single variable, has no
 * linear term (b = 0, already complete), or otherwise can't be completed (#62).
 */
export const tryCompleteTheSquare = (node: math.MathNode): math.MathNode | null => {
  if (!node) return null;

  for (const solveVar of getVariables(node)) {
    const coeffs = tryExtractQuadraticExpr(node, solveVar);
    if (!coeffs) continue;

    // Require numeric a, b, c so the completed form is exact and self-contained.
    // Symbolic coefficients (e.g. a stray second variable) are deferred.
    let af: math.Fraction, bf: math.Fraction, cf: math.Fraction;
    try {
      af = mjs.fraction(coeffs.a.compile().evaluate());
      bf = mjs.fraction(coeffs.b.compile().evaluate());
      cf = mjs.fraction(coeffs.c.compile().evaluate());
    } catch {
      continue;
    }

    // a ≠ 0 (must be quadratic) and b ≠ 0 (b = 0 is already a completed square).
    if (Number(af.n) === 0 || Number(bf.n) === 0) continue;

    // h = b / (2a); k = c − b² / (4a)
    const h = mjs.divide(bf, mjs.multiply(af, 2) as math.Fraction) as math.Fraction;
    const k = mjs.subtract(
      cf,
      mjs.divide(mjs.multiply(bf, bf) as math.Fraction, mjs.multiply(af, 4) as math.Fraction)
    ) as math.Fraction;

    // (v ± |h|)
    const inner = new mjs.OperatorNode(
      h.s < 0 ? '-' : '+',
      h.s < 0 ? 'subtract' : 'add',
      [new mjs.SymbolNode(solveVar), fractionToNode(mjs.abs(h) as math.Fraction)]
    );
    const squared = new mjs.OperatorNode('^', 'pow', [
      new mjs.ParenthesisNode(inner),
      new mjs.ConstantNode(2),
    ]);

    // a · (…)², dropping a redundant ×1
    const scaled: math.MathNode =
      Number(af.n) === 1 && Number(af.d) === 1
        ? squared
        : new mjs.OperatorNode('*', 'multiply', [fractionToNode(af), squared]);

    // … ± |k|, dropping a redundant + 0
    const result: math.MathNode =
      Number(k.n) === 0
        ? scaled
        : new mjs.OperatorNode(
            k.s < 0 ? '-' : '+',
            k.s < 0 ? 'subtract' : 'add',
            [scaled, fractionToNode(mjs.abs(k) as math.Fraction)]
          );

    return result;
  }

  return null;
};

/**
 * Identifies distribution opportunities (e.g. a * (b + c) -> a * b + a * c, or (b + c) / a -> b / a + c / a)
 * and returns the expanded mathematical node.
 */
export const tryDistribution = (node: math.MathNode): math.MathNode | null => {
  if (!node) return null;

  // A distributable inner term must be a BINARY `+`/`-`. A unary minus (e.g. `-1`,
  // `-x`) also has op `-` but only one arg; treating it as `(b - c)` reads a
  // missing second operand and throws (which silently hid valid folds and crashed
  // autoSimplify on `-x * -1`).
  const isBinaryAddSub = (n: math.MathNode): boolean =>
    n.type === 'OperatorNode' &&
    ((n as math.OperatorNode).op === '+' || (n as math.OperatorNode).op === '-') &&
    (n as math.OperatorNode).args.length === 2;

  // Case 1: Multiplication, e.g. a * (b + c) or (b + c) * a
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '*') {
    const opNode = node as math.OperatorNode;
    const left = opNode.args[0];
    const right = opNode.args[1];

    // Subcase 1A: a * (b + c) or a * (b - c)
    let rightContent = right;
    while (rightContent.type === 'ParenthesisNode') {
      rightContent = (rightContent as math.ParenthesisNode).content;
    }
    if (isBinaryAddSub(rightContent)) {
      const innerOp = rightContent as math.OperatorNode;
      const a = left;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new mjs.OperatorNode('*', 'multiply', [a, b]);
      const term2 = new mjs.OperatorNode('*', 'multiply', [a, c]);
      return new mjs.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new mjs.ParenthesisNode(term1),
        new mjs.ParenthesisNode(term2),
      ]);
    }

    // Subcase 1B: (b + c) * a or (b - c) * a
    let leftContent = left;
    while (leftContent.type === 'ParenthesisNode') {
      leftContent = (leftContent as math.ParenthesisNode).content;
    }
    if (isBinaryAddSub(leftContent)) {
      const innerOp = leftContent as math.OperatorNode;
      const a = right;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new mjs.OperatorNode('*', 'multiply', [b, a]);
      const term2 = new mjs.OperatorNode('*', 'multiply', [c, a]);
      return new mjs.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new mjs.ParenthesisNode(term1),
        new mjs.ParenthesisNode(term2),
      ]);
    }
  }

  // Case 2: Division, e.g. (b + c) / a or (b - c) / a
  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '/') {
    const opNode = node as math.OperatorNode;
    const left = opNode.args[0];
    const right = opNode.args[1];

    let leftContent = left;
    while (leftContent.type === 'ParenthesisNode') {
      leftContent = (leftContent as math.ParenthesisNode).content;
    }
    if (isBinaryAddSub(leftContent)) {
      const innerOp = leftContent as math.OperatorNode;
      const a = right;
      const b = innerOp.args[0];
      const c = innerOp.args[1];
      const op = innerOp.op;

      const term1 = new mjs.OperatorNode('/', 'divide', [b, a]);
      const term2 = new mjs.OperatorNode('/', 'divide', [c, a]);
      return new mjs.OperatorNode(op, op === '+' ? 'add' : 'subtract', [
        new mjs.ParenthesisNode(term1),
        new mjs.ParenthesisNode(term2),
      ]);
    }
  }

  return null;
};

/**
 * Helper to check if two paths are compatible for double removal (algebraic inverse cancellation).
 * Disallows mixed additive/multiplicative parent chains or function node boundaries.
 */
export const arePathsCompatibleForDoubleRemoval = (eq: Equation, p1: string, p2: string): boolean => {
  const parts1 = p1.split('/');
  const parts2 = p2.split('/');
  const commonParts: string[] = [];
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      commonParts.push(parts1[i]);
    } else {
      break;
    }
  }
  const lcaPath = commonParts.join('/');
  if (!lcaPath) return false;

  const getOperatorsInPathToLCA = (path: string): string[] => {
    const operators: string[] = [];
    let current = path;
    while (current !== lcaPath && current.includes('/')) {
      current = current.substring(0, current.lastIndexOf('/'));
      try {
        const node = getNodeByPath(eq, current);
        if (node.type === 'OperatorNode') {
          operators.push((node as math.OperatorNode).op);
        } else {
          operators.push('other');
        }
      } catch {
        operators.push('other');
      }
    }
    return operators;
  };

  const ops1 = getOperatorsInPathToLCA(p1);
  const ops2 = getOperatorsInPathToLCA(p2);

  try {
    const lcaNode = getNodeByPath(eq, lcaPath);
    if (lcaNode.type === 'OperatorNode') {
      ops1.push((lcaNode as math.OperatorNode).op);
    } else {
      ops1.push('other');
    }
  } catch {
    ops1.push('other');
  }

  const allOps = [...ops1, ...ops2];
  const hasAdditive = allOps.some(op => op === '+' || op === '-');
  const hasMultiplicative = allOps.some(op => op === '*' || op === '/');
  const hasOther = allOps.some(op => op !== '+' && op !== '-' && op !== '*' && op !== '/');

  if (hasOther) return false;
  if (hasAdditive && hasMultiplicative) return false;
  return true;
};

/**
 * Helper to combine multiplied terms of the same base (e.g. x * x -> x^2, x^2 * x -> x^3, x^A * x^B -> x^(A + B)).
 */
export const tryCombinePowerTerms = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode' || (node as math.OperatorNode).op !== '*') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  const left = opNode.args[0];
  const right = opNode.args[1];

  let baseLeft = left;
  let expLeft: math.MathNode = new mjs.ConstantNode(1);
  if (left.type === 'OperatorNode' && (left as math.OperatorNode).op === '^') {
    baseLeft = (left as math.OperatorNode).args[0];
    expLeft = (left as math.OperatorNode).args[1];
  }

  let baseRight = right;
  let expRight: math.MathNode = new mjs.ConstantNode(1);
  if (right.type === 'OperatorNode' && (right as math.OperatorNode).op === '^') {
    baseRight = (right as math.OperatorNode).args[0];
    expRight = (right as math.OperatorNode).args[1];
  }

  // Helper to strip outer parentheses for base comparison
  const getCleanBaseStr = (n: math.MathNode): string => {
    let curr = n;
    while (curr.type === 'ParenthesisNode') {
      curr = (curr as math.ParenthesisNode).content;
    }
    return curr.toString();
  };

  if (getCleanBaseStr(baseLeft) === getCleanBaseStr(baseRight)) {
    // Combine them!
    // Exponent sum: expLeft + expRight
    let sumNode: math.MathNode;
    try {
      const valL = expLeft.type === 'ConstantNode' ? Number((expLeft as math.ConstantNode).value) : NaN;
      const valR = expRight.type === 'ConstantNode' ? Number((expRight as math.ConstantNode).value) : NaN;
      if (!isNaN(valL) && !isNaN(valR)) {
        sumNode = new mjs.ConstantNode(valL + valR);
      } else {
        sumNode = new mjs.OperatorNode('+', 'add', [expLeft, expRight]);
      }
    } catch {
      sumNode = new mjs.OperatorNode('+', 'add', [expLeft, expRight]);
    }

    return new mjs.OperatorNode('^', 'pow', [baseLeft, sumNode]);
  }

  return null;
};

/**
 * Helper to expand a power term to repeated multiplication (e.g. x^3 -> x * x * x).
 * Limited to positive integer exponents >= 2 and <= 10 (to avoid excessive growth).
 */
export const tryExpandPowerTerm = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode' || (node as math.OperatorNode).op !== '^') {
    return null;
  }
  const opNode = node as math.OperatorNode;
  const base = opNode.args[0];
  const exponent = opNode.args[1];

  if (exponent.type !== 'ConstantNode') {
    return null;
  }
  const n = Number((exponent as math.ConstantNode).value);
  if (!Number.isInteger(n) || n < 2 || n > 10) {
    return null;
  }

  // Construct base * base * ... * base (n times)
  let result = base;
  for (let i = 1; i < n; i++) {
    result = new mjs.OperatorNode('*', 'multiply', [result, base]);
  }
  return result;
};

/**
 * The integer value of a node, seeing through parentheses and a unary minus
 * (e.g. `-(3)` -> -3). Returns null for non-integer constants or anything
 * variable. Used by fraction combination to decide the LCD path.
 */
const integerValueOf = (node: math.MathNode): number | null => {
  const n = unwrapParens(node);
  if (n.type === 'OperatorNode' && (n as math.OperatorNode).op === '-' && (n as math.OperatorNode).args.length === 1) {
    const inner = integerValueOf((n as math.OperatorNode).args[0]);
    return inner === null ? null : -inner;
  }
  if (n.type === 'ConstantNode') {
    const v = Number((n as math.ConstantNode).value);
    return Number.isInteger(v) ? v : null;
  }
  return null;
};

const isOneNode = (node: math.MathNode): boolean => integerValueOf(node) === 1;

const gcdInt = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};

const lcmInt = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcdInt(a, b));

/** Multiply two factors, dropping a trivial ×1 and folding constant×constant. */
const multiplyFactors = (a: math.MathNode, b: math.MathNode): math.MathNode => {
  const av = integerValueOf(a);
  const bv = integerValueOf(b);
  if (av !== null && bv !== null) return new mjs.ConstantNode(av * bv);
  if (isOneNode(a)) return b;
  if (isOneNode(b)) return a;
  return new mjs.OperatorNode('*', 'multiply', [a, b]);
};

interface SignedTerm {
  readonly sign: 1 | -1;
  readonly node: math.MathNode;
}

/** Flatten an additive chain into signed leaf terms (a + b - c -> +a, +b, -c). */
const flattenAddSub = (node: math.MathNode, sign: 1 | -1, out: SignedTerm[]): void => {
  const n = unwrapParens(node);
  if (n.type === 'OperatorNode') {
    const op = (n as math.OperatorNode).op;
    const args = (n as math.OperatorNode).args;
    if (op === '+' && args.length === 2) {
      flattenAddSub(args[0], sign, out);
      flattenAddSub(args[1], sign, out);
      return;
    }
    if (op === '-' && args.length === 2) {
      flattenAddSub(args[0], sign, out);
      flattenAddSub(args[1], sign === 1 ? -1 : 1, out);
      return;
    }
    if (op === '-' && args.length === 1) {
      flattenAddSub(args[0], sign === 1 ? -1 : 1, out);
      return;
    }
  }
  out.push({ sign, node });
};

/**
 * Combine a sum/difference of fractions over a common denominator
 * (`a/b ± c/d -> (a·d ± b·c)/(b·d)`), the inverse of fraction decomposition
 * (#38). Flattens the additive chain into signed terms; each term must be a
 * division node or an integer constant (so mixed integer+fraction works, e.g.
 * `1/2 + 1`). Requires at least one real fraction, so plain sums like `x + 1`
 * are left alone. Uses the least common denominator when every denominator is a
 * positive integer (`2/3 + 1/6 -> (4 + 1)/6`); otherwise the product of the
 * distinct denominators (`1/x + 1/y -> (y + x)/(x·y)`). The resulting
 * `b·d ≠ 0` domain assumption is surfaced downstream by
 * `domainRestrictionsForReduction` (#63).
 */
export const tryCombineFractions = (node: math.MathNode): math.MathNode | null => {
  if (node.type !== 'OperatorNode') return null;
  const rootOp = (node as math.OperatorNode).op;
  if ((rootOp !== '+' && rootOp !== '-') || (node as math.OperatorNode).args.length !== 2) return null;

  const flat: SignedTerm[] = [];
  flattenAddSub(node, 1, flat);
  if (flat.length < 2) return null;

  // Decompose each term into numerator / denominator. Bail on any term that is
  // neither a fraction nor an integer constant — combining those would be noise.
  const terms: { sign: 1 | -1; num: math.MathNode; den: math.MathNode }[] = [];
  let fractionCount = 0;
  for (const { sign, node: termNode } of flat) {
    const inner = unwrapParens(termNode);
    if (inner.type === 'OperatorNode' && (inner as math.OperatorNode).op === '/' && (inner as math.OperatorNode).args.length === 2) {
      const den = unwrapParens((inner as math.OperatorNode).args[1]);
      terms.push({ sign, num: (inner as math.OperatorNode).args[0], den });
      if (!isOneNode(den)) fractionCount++;
    } else if (integerValueOf(inner) !== null) {
      terms.push({ sign, num: inner, den: new mjs.ConstantNode(1) });
    } else {
      return null;
    }
  }
  if (fractionCount < 1) return null;

  // Common denominator: LCD when every denominator is a positive integer,
  // otherwise the product of the distinct denominators.
  const denVals = terms.map((t) => integerValueOf(t.den));
  const allPositiveInt = denVals.every((v) => v !== null && v > 0);

  const clean = (s: string) => s.replace(/[\s()]/g, '');
  let denominator: math.MathNode;
  let cofactorFor: (i: number) => math.MathNode;

  if (allPositiveInt) {
    const lcd = (denVals as number[]).reduce((acc, v) => lcmInt(acc, v), 1);
    denominator = new mjs.ConstantNode(lcd);
    cofactorFor = (i) => new mjs.ConstantNode(lcd / (denVals[i] as number));
  } else {
    // Distinct, non-unit denominators (deduped by string form).
    const distinct: math.MathNode[] = [];
    const seen = new Set<string>();
    for (const t of terms) {
      if (isOneNode(t.den)) continue;
      const key = clean(t.den.toString());
      if (!seen.has(key)) {
        seen.add(key);
        distinct.push(t.den);
      }
    }
    denominator = distinct.reduce((acc, d) => multiplyFactors(acc, d), new mjs.ConstantNode(1) as math.MathNode);
    cofactorFor = (i) => {
      const skip = clean(terms[i].den.toString());
      return distinct
        .filter((d) => clean(d.toString()) !== skip)
        .reduce((acc, d) => multiplyFactors(acc, d), new mjs.ConstantNode(1) as math.MathNode);
    };
  }

  // Build the combined numerator as a signed sum of num·cofactor contributions.
  let numerator: math.MathNode | null = null;
  terms.forEach((t, i) => {
    const contrib = multiplyFactors(t.num, cofactorFor(i));
    if (numerator === null) {
      numerator = t.sign === -1 ? new mjs.OperatorNode('-', 'unaryMinus', [contrib]) : contrib;
    } else {
      numerator = new mjs.OperatorNode(
        t.sign === -1 ? '-' : '+',
        t.sign === -1 ? 'subtract' : 'add',
        [numerator, contrib],
      );
    }
  });
  if (numerator === null) return null;

  return new mjs.OperatorNode('/', 'divide', [numerator, denominator]);
};

/**
 * True when some strict descendant of `p` has its own atomic simplification —
 * an identity element to drop (× 1, + 0), a constant subtree to fold, powers to
 * combine, or a root/power to reduce.
 *
 * Used to stop the whole-subtree `math.simplify` fallback (step 5 below) from
 * collapsing several elementary moves into one opaque click (#59): if a finer
 * move is available deeper in the subtree, offer that instead and let the
 * student take it stepwise — the collapse re-emerges, smaller, on the next pass.
 * Deliberately cheap (never recurses into `math.simplify`) so it stays close to
 * O(subtree size). A lone cancellation like `m * x / x -> m` has no finer
 * descendant move and is therefore still offered as a single step.
 */
const subtreeHasFinerSimplification = (eq: Equation, p: string): boolean => {
  const descendants = getAllPaths(eq).filter((dp) => dp.startsWith(`${p}/`));
  for (const dp of descendants) {
    let node: math.MathNode;
    try {
      node = getNodeByPath(eq, dp);
    } catch {
      continue;
    }
    if (!node) continue;

    // A constant subtree that folds to a different form (e.g. 2 * 3 -> 6).
    if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
      const folded = evaluateConstantSubtree(node);
      if (folded) {
        const clean = (s: string) => s.replace(/[\s()]/g, '');
        if (clean(folded.toString()) !== clean(node.toString())) return true;
      }
    }

    // An identity element to drop in place (× 1, + 0): a single removal that
    // leaves the containing side's value unchanged for every assignment.
    const removed = trySingleRemoval(eq, dp);
    if (removed) {
      const side = dp.split('/')[0] as 'lhs' | 'rhs';
      if (areExpressionsValueEqual(eq[side], removed[side])) return true;
    }

    // Powers to combine (x * x -> x^2) or a root/power to reduce (sqrt(x^2)).
    if (tryCombinePowerTerms(node)) return true;
    if (trySimplifyRootOfPower(node) || trySimplifyPowerOfRoot(node)) return true;

    // A numeric radical with an extractable perfect-power factor (sqrt(8) -> 2√2).
    if (trySimplifyRadical(node)) return true;

    // Like radicals to combine (sqrt(2) + sqrt(2) -> 2√2).
    if (tryCombineLikeRadicals(node)) return true;

    // A radical denominator to rationalize (1 / sqrt(2) -> sqrt(2) / 2).
    if (tryRationalizeDenominator(node)) return true;
  }
  return false;
};

/**
 * Checks if a given path has a simplification opportunity.
 * Returns the simplified Equation if found, otherwise null.
 */
/**
 * True when `node` is a division whose denominator is — or folds to — the
 * constant zero (a literal `/ 0`, or `/ (2 - 2)` etc.). Such an expression is
 * undefined.
 */
const isZeroDenominatorDivision = (node: math.MathNode): boolean => {
  if (node.type !== 'OperatorNode') return false;
  const op = node as math.OperatorNode;
  if (op.op !== '/' || op.args.length !== 2) return false;
  const den = unwrapParens(op.args[1]);
  if (!isConstantSubtree(den)) return false;
  try {
    return Number(den.compile().evaluate()) === 0;
  } catch {
    // A denominator we can't evaluate isn't a provable zero — leave it be.
    return false;
  }
};

/**
 * True when the path `p` is entangled with a division by zero — either the
 * subtree at `p` contains a `/ 0` (so folding it would fabricate a value), or `p`
 * sits at or inside a `/ 0` (so a removal could collapse the division onto its
 * zero denominator, e.g. dropping the `x` in `x / 0 -> 0`). Both cases are
 * mathematically undefined, so no simplification may be offered. mathjs's
 * `simplify` and the numeric equivalence sampler otherwise let the bad rewrite
 * slip through every guard and reach the learner (#333).
 */
const pathTouchesZeroDenominator = (eq: Equation, p: string): boolean => {
  // Self or descendant divides by zero.
  let found = false;
  try {
    getNodeByPath(eq, p).traverse((n) => {
      if (!found && isZeroDenominatorDivision(n)) found = true;
    });
  } catch {
    // ignore
  }
  if (found) return true;

  // An ancestor divides by zero (p is a numerator/denominator inside a `/ 0`).
  const parts = p.split('/');
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = i === 0 ? parts[0] : `${prefix}/${parts[i]}`;
    try {
      if (isZeroDenominatorDivision(getNodeByPath(eq, prefix))) return true;
    } catch {
      // ignore
    }
  }
  return false;
};

/**
 * Collects the path of every division subtree in `eq` whose denominator is — or
 * folds to — the constant zero. Such a subtree is undefined (division by zero),
 * so the UI can annotate it as a dead end rather than a place to make a move
 * (#413). Complements the #333 guards (`pathTouchesZeroDenominator`), which
 * *suppress* reductions on these paths so no invalid `x / 0 -> 0` fold slips
 * through; this surfaces the honest diagnostic the learner sees in that silence.
 *
 * Only the division node itself is flagged — the smallest offending subtree — so
 * the UI can badge exactly the `/ 0` and not its ancestors. A valid sibling term
 * (`x / 5` in `x / 0 + x / 5`) is never flagged.
 */
export const getUndefinedDivisionPaths = (eq: Equation): string[] => {
  const paths: string[] = [];
  for (const path of getAllPaths(eq)) {
    try {
      if (isZeroDenominatorDivision(getNodeByPath(eq, path))) paths.push(path);
    } catch {
      // An unresolvable path can't be an undefined division — skip it.
    }
  }
  return paths;
};

const getSimplificationForPathRaw = (eq: Equation, p: string): Equation | null => {
  try {
    const node = getNodeByPath(eq, p);
    if (!node) return null;

    // #333: never offer a simplification entangled with a division by zero — it
    // is undefined, and the reduce paths (the mathjs fallback in step 5, or a
    // numerator removal that collapses `x / 0` onto its `0`) would otherwise
    // fabricate a mathematically wrong value.
    if (pathTouchesZeroDenominator(eq, p)) return null;

    const isDiff = (candidate: Equation): boolean => {
      const clean = (s: string) => s.replace(/[\s()]/g, '');
      return clean(candidate.lhs.toString()) !== clean(eq.lhs.toString()) ||
             clean(candidate.rhs.toString()) !== clean(eq.rhs.toString());
    };

    // 0. Simplify a numeric radical (sqrt(8) -> 2 * sqrt(2)). Offered BEFORE
    // constant folding so the exact radical wins over decimalising the
    // irrational (folding sqrt(8) would otherwise yield 2.83) — #66.
    const radicalSimplified = trySimplifyRadical(node);
    if (radicalSimplified) {
      const candidate = replaceNodeAtPath(eq, p, radicalSimplified);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 0.5 Combine like radicals (sqrt(2) + sqrt(2) -> 2 * sqrt(2)). Offered
    // BEFORE constant folding so the exact term wins over decimalising the sum
    // (folding sqrt(2) + sqrt(2) would otherwise yield 2.83) — #66.
    const combinedRadicals = tryCombineLikeRadicals(node);
    if (combinedRadicals) {
      const candidate = replaceNodeAtPath(eq, p, combinedRadicals);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 0.6 Rationalize a radical denominator (1 / sqrt(2) -> sqrt(2) / 2). Offered
    // BEFORE constant folding so the exact rationalized form wins over decimalising
    // the fraction (folding 1 / sqrt(2) would otherwise yield 0.707) — #66.
    const rationalized = tryRationalizeDenominator(node);
    if (rationalized) {
      const candidate = replaceNodeAtPath(eq, p, rationalized);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 1. Try constant folding first (non-constant subtrees composed entirely of constants)
    if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
      const folded = evaluateConstantSubtree(node);
      if (folded) {
        const clean = (str: string) => str.replace(/[\s()]/g, '');
        if (clean(folded.toString()) !== clean(node.toString())) {
          const candidate = replaceNodeAtPath(eq, p, folded);
          if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
            return candidate;
          }
        }
      }
    }

    if (node.type === 'ParenthesisNode') {
      const paren = node as math.ParenthesisNode;
      const candidate = replaceNodeAtPath(eq, p, paren.content);
      const eqStr = `${eq.lhs.toString()} = ${eq.rhs.toString()}`;
      const candidateStr = `${candidate.lhs.toString()} = ${candidate.rhs.toString()}`;
      if (eqStr !== candidateStr && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 2.5 Try simplifying root of power (e.g. sqrt(x ^ 2) -> x) or power of root (e.g. (sqrt(x)) ^ 2 -> x)
    const rootPowerSimplified = trySimplifyRootOfPower(node) || trySimplifyPowerOfRoot(node);
    if (rootPowerSimplified) {
      const candidate = replaceNodeAtPath(eq, p, rootPowerSimplified);
      if (isDiff(candidate)) {
        return candidate;
      }
    }

    // 2.6 Try combining power terms (e.g. x * x -> x^2)
    const combinedPower = tryCombinePowerTerms(node);
    if (combinedPower) {
      const candidate = replaceNodeAtPath(eq, p, combinedPower);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 2.7 Try algebraic distribution, e.g. a * (b + c) -> a * b + a * c
    const distributedNode = tryDistribution(node);
    if (distributedNode) {
      const candidate = replaceNodeAtPath(eq, p, distributedNode);
      if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
        return candidate;
      }
    }

    // 3. Try single removal of this node. A genuine simplification is a LOCAL
    // identity — the modified side keeps its value for every variable assignment
    // (e.g. x + 0 -> x) — not merely an equation with the same roots. This
    // rejects denominator/factor removals that are valid only because of the
    // equation structure: A/5 = 0 -> A = 0 is a both-sides multiply, not a
    // simplify of the 5, and is outright lossy for a variable denominator (#33).
    const singleCandidate = trySingleRemoval(eq, p);
    if (singleCandidate && isDiff(singleCandidate)) {
      const side = p.split('/')[0] as 'lhs' | 'rhs';
      if (areExpressionsValueEqual(eq[side], singleCandidate[side])) {
        return singleCandidate;
      }
    }

    // 4. Try double removal involving this node and another node only if compatible (direct inverses)
    const allPaths = getAllPaths(eq);
    for (let i = 0; i < allPaths.length; i++) {
      const otherPath = allPaths[i];
      if (otherPath === p) continue;
      if (!arePathsCompatibleForDoubleRemoval(eq, p, otherPath)) continue;
      const doubleCandidate = tryDoubleRemoval(eq, p, otherPath);
      if (doubleCandidate && isDiff(doubleCandidate) && areEquationsEquivalent(eq, doubleCandidate)) {
        return doubleCandidate;
      }
    }

    // 5. Try mathjs built-in simplify for algebraic reductions (e.g. combining
    // like terms: 3 * x - x -> 2 * x). This is the black-box fallback, so only
    // offer it as an ATOMIC move: if a finer elementary simplification exists
    // deeper in this subtree, don't collapse the whole thing in one opaque click
    // (#59) — the granular step is offered instead and the collapse re-emerges,
    // smaller, after the student takes it.
    if (!subtreeHasFinerSimplification(eq, p)) {
      try {
        const simplifiedNode = mjs.simplify(node.toString());
        if (simplifiedNode.toString() !== node.toString()) {
          // Enforce complexity reduction to filter out non-simplifying reorderings (e.g. (y - 1) * 2 -> 2 * (y - 1))
          if (
            countNodes(simplifiedNode) < countNodes(node) ||
            (countNodes(simplifiedNode) === countNodes(node) && countSymbolNodes(simplifiedNode) < countSymbolNodes(node))
          ) {
            const candidate = replaceNodeAtPath(eq, p, simplifiedNode);
            if (isDiff(candidate) && areEquationsEquivalent(eq, candidate)) {
              return candidate;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // Graceful fallback
  }

  return null;
};

export const getSimplificationForPath = (eq: Equation, p: string): Equation | null => {
  const result = getSimplificationForPathRaw(eq, p);
  return result ? ensureNodeIds(result) : null;
};

/**
 * Automatically simplifies an equation by trying all single and double node
 * removals and verifying equivalence. Iterates until no more nodes can be removed.
 */
export const autoSimplify = (eq: Equation): Equation => {
  let currentEq = eq;
  let simplified = true;

  // Max iterations safeguard to prevent any infinite loops
  const maxIterations = 50;
  let iteration = 0;

  while (simplified && iteration < maxIterations) {
    simplified = false;
    iteration++;

    const paths = getAllPaths(currentEq);

    // 1. Try single term eliminations, parenthesis unwrapping, or constant folding
    for (let i = 0; i < paths.length; i++) {
      const node = getNodeByPath(currentEq, paths[i]);

      // Try constant folding first
      if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
        const folded = evaluateConstantSubtree(node);
        if (folded) {
          const clean = (str: string) => str.replace(/[\s()]/g, '');
          if (clean(folded.toString()) !== clean(node.toString())) {
            const candidate = replaceNodeAtPath(currentEq, paths[i], folded);
            if (areEquationsEquivalent(currentEq, candidate)) {
              currentEq = candidate;
              simplified = true;
              break; // Restart scan on the simplified tree
            }
          }
        }
      }

      // Unpack redundant parentheses (e.g. (x) -> x)
      if (node.type === 'ParenthesisNode') {
        const paren = node as math.ParenthesisNode;
        const candidate = replaceNodeAtPath(currentEq, paths[i], paren.content);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try root of power simplification (e.g. sqrt(x ^ 2) -> x) or power of root (e.g. (sqrt(x)) ^ 2 -> x)
      const rootPowerSimplified = trySimplifyRootOfPower(node) || trySimplifyPowerOfRoot(node);
      if (rootPowerSimplified) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], rootPowerSimplified);
        currentEq = candidate;
        simplified = true;
        break; // Restart scan on the simplified tree
      }

      // Try combining power terms (e.g. x * x -> x^2)
      const combinedPower = tryCombinePowerTerms(node);
      if (combinedPower) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], combinedPower);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try algebraic distribution, e.g. a * (b + c) -> a * b + a * c
      const distributedNode = tryDistribution(node);
      if (distributedNode) {
        const candidate = replaceNodeAtPath(currentEq, paths[i], distributedNode);
        if (areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try removing the single node (only when it is a local identity — see #33)
      const candidate = trySingleRemoval(currentEq, paths[i]);
      if (candidate) {
        const side = paths[i].split('/')[0] as 'lhs' | 'rhs';
        if (areExpressionsValueEqual(currentEq[side], candidate[side])) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }

      // Try mathjs built-in simplify for algebraic reductions (e.g. combining like terms)
      try {
        const simplifiedNode = mjs.simplify(node.toString());
        if (simplifiedNode.toString() !== node.toString()) {
          // Enforce complexity reduction to filter out non-simplifying reorderings (e.g. (y - 1) * 2 -> 2 * (y - 1))
          if (
            countNodes(simplifiedNode) < countNodes(node) ||
            (countNodes(simplifiedNode) === countNodes(node) && countSymbolNodes(simplifiedNode) < countSymbolNodes(node))
          ) {
            const candidate = replaceNodeAtPath(currentEq, paths[i], simplifiedNode);
            if (areEquationsEquivalent(currentEq, candidate)) {
              currentEq = candidate;
              simplified = true;
              break; // Restart scan on the simplified tree
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (simplified) continue;

    // 2. Try pair eliminations (e.g. + x - x, * y / y)
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const candidate = tryDoubleRemoval(currentEq, paths[i], paths[j]);
        if (candidate && areEquationsEquivalent(currentEq, candidate)) {
          currentEq = candidate;
          simplified = true;
          break; // Restart scan on the simplified tree
        }
      }
      if (simplified) break;
    }
  }

  return currentEq;
};

export interface ReductionOption {
  readonly path: string;
  readonly simplified: Equation;
  readonly type: 'reduce' | 'expand' | 'factor' | 'identity';
  readonly label?: string;
}

/**
 * Traverses an equation to discover all algebraic simplification, distribution,
 * and identity-based reduction opportunities, returns them grouped by path,
 * and deduplicates functionally identical outcomes favoring more specific labels.
 */
export const getReducibleOptions = (eq: Equation): Record<string, ReductionOption[]> => {
  const allNodePaths: string[] = [];
  const traversePaths = (node: math.MathNode, prefix: string) => {
    if (!node) return;
    allNodePaths.push(prefix);
    const children = 'args' in node ? (node as any).args : ('content' in node ? [(node as any).content] : []);
    children.forEach((child: math.MathNode, index: number) => {
      if (child) traversePaths(child, `${prefix}/${index}`);
    });
  };
  traversePaths(eq.lhs, 'lhs');
  traversePaths(eq.rhs, 'rhs');

  const rawReductions: ReductionOption[] = [];

  allNodePaths.forEach((path) => {
    // #333: a path entangled with a division by zero is undefined — skip it so no
    // reduce/factor/identity path can fold `x / 0` into a spurious value. Mirrors
    // the guard in getSimplificationForPathRaw; a valid move on a sibling subtree
    // (without a zero denominator) is still discovered at its own path.
    if (pathTouchesZeroDenominator(eq, path)) return;

    // Try standard simplification/distribution
    try {
      const simplified = getSimplificationForPath(eq, path);
      if (simplified) {
        const node = getNodeByPath(eq, path);
        const distNode = tryDistribution(node);

        const clean = (s: string) => s.replace(/[\s()]/g, '');
        // A simplification can collapse the parent so `path` no longer resolves
        // in `simplified` (e.g. m * 1 -> m drops the node at the `1`'s path).
        // That just means it wasn't a distribution — it must not throw out the
        // whole (valid) reduction, which previously hid obvious × 1 / + 0 drops.
        let isActualDistribution = false;
        if (distNode) {
          try {
            const targetNodeInSimplified = getNodeByPath(simplified, path);
            isActualDistribution = clean(targetNodeInSimplified.toString()) === clean(distNode.toString());
          } catch {
            isActualDistribution = false;
          }
        }

        let label: string | undefined = undefined;
        if (isActualDistribution) {
          label = 'Distribute';
        } else if (trySimplifyRadical(node)) {
          label = 'Simplify Radical';
        } else if (tryCombineLikeRadicals(node)) {
          label = 'Combine Like Radicals';
        } else if (tryRationalizeDenominator(node)) {
          label = 'Rationalize Denominator';
        } else {
          const isFraction = node.type === 'OperatorNode' && (node as math.OperatorNode).op === '/';
          label = isFraction ? 'Simplify Fraction' : 'Simplify';
        }

        rawReductions.push({
          path,
          simplified,
          type: isActualDistribution ? 'expand' : 'reduce',
          label
        });

        // If the node can be distributed but was simplified in a different way (e.g. constant folded),
        // offer the distribution option separately.
        if (distNode && !isActualDistribution) {
          const eqDist = replaceNodeAtPath(eq, path, distNode);
          const cleanEq = (e: Equation) => `${clean(e.lhs.toString())}=${clean(e.rhs.toString())}`;
          if (cleanEq(eqDist) !== cleanEq(eq) && areEquationsEquivalent(eq, eqDist)) {
            rawReductions.push({
              path,
              simplified: eqDist,
              type: 'expand',
              label: 'Distribute'
            });
          }
        }
      }
    } catch {}

    // Try evaluating constant subtrees to decimal floats
    try {
      const node = getNodeByPath(eq, path);
      if (node.type !== 'ConstantNode' && isConstantSubtree(node)) {
        const val = node.compile().evaluate();
        let numVal: number | null = null;
        if (typeof val === 'number') {
          numVal = val;
        } else if (val && typeof val === 'object' && 'toNumber' in val) {
          numVal = (val as unknown as { toNumber: () => number }).toNumber();
        } else {
          const parsed = parseFloat(val?.toString());
          if (!isNaN(parsed)) {
            numVal = parsed;
          }
        }

        if (numVal !== null && !isNaN(numVal) && isFinite(numVal)) {
          if (!Number.isInteger(numVal)) {
            const decNode = new mjs.ConstantNode(numVal);
            const newEq = replaceNodeAtPath(eq, path, decNode);
            
            if (areEquationsEquivalent(eq, newEq)) {
              const clean = (str: string) => str.replace(/[\s()]/g, '');
              if (clean(decNode.toString()) !== clean(node.toString())) {
                rawReductions.push({
                  path,
                  simplified: newEq,
                  type: 'reduce',
                  label: 'Evaluate to Decimal'
                });
              }
            }
          }
        }
      }
    } catch {}

    // Simplify a constant ℂ-subtree to a + b·ⅈ standard form (ⅈ² → −1, power
    // cycling, combining like imaginary terms). Arithmetic on ⅈ already present
    // in the equation, so — unlike the extend-to-ℂ doorway below — it is NOT
    // gated on allowComplex. (#105)
    try {
      const node = getNodeByPath(eq, path);
      const folded = trySimplifyComplexConstant(node);
      if (folded) {
        const newEq = replaceNodeAtPath(eq, path, folded.node);
        if (areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({
            path,
            simplified: newEq,
            type: 'reduce',
            label: folded.label,
          });
        }
      }
    } catch {}

    // Rationalize a complex denominator by multiplying through by the conjugate
    // (1/(2+ⅈ) → (2−ⅈ)/5). Exact form, so — like the real rationalizer — it is
    // ungated. (#105)
    try {
      const node = getNodeByPath(eq, path);
      const rationalized = tryRationalizeComplexDenominator(node);
      if (rationalized) {
        const newEq = replaceNodeAtPath(eq, path, rationalized);
        if (areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({
            path,
            simplified: newEq,
            type: 'reduce',
            label: 'Rationalize Denominator',
          });
        }
      }
    } catch {}

    // Extend to ℂ: a square root of a negative has no real value; offer
    // resolving it to imaginary form √−A → √A·ⅈ. Emitted unconditionally here;
    // the UI gates it on the `allowComplex` setting, exactly as it gates
    // "Evaluate to Decimal" (#105).
    try {
      const node = getNodeByPath(eq, path);
      const complexNode = tryExtendToComplex(node);
      if (complexNode) {
        const newEq = replaceNodeAtPath(eq, path, complexNode);
        if (areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({
            path,
            simplified: newEq,
            type: 'reduce',
            label: 'Extend to ℂ',
          });
        }
      }
    } catch {}

    // Try high-school algebraic identity matches
    try {
      const node = getNodeByPath(eq, path);
      for (const rule of HIGH_SCHOOL_IDENTITIES) {
        const bindings = matchPattern(rule.sourcePattern, node);
        if (bindings) {
          // Exclude Split Fraction if the numerator is 1
          if (rule.id === 'fraction_decompose') {
            const aNode = bindings['_A'];
            if (aNode) {
              let unwrapped = aNode;
              while (unwrapped.type === 'ParenthesisNode') {
                unwrapped = (unwrapped as math.ParenthesisNode).content;
              }
              if (unwrapped.type === 'ConstantNode' && Number((unwrapped as math.ConstantNode).value) === SPLIT_NUMERATOR_SUPPRESS_VALUE) {
                continue;
              }
            }
          }

          // Exclude n = 2 for nthRoot exponent rules to prevent duplicate square root rules
          if (rule.id === 'exponent_nthRoot_reverse' || rule.id === 'exponent_nthRoot') {
            const nNode = bindings['_n'];
            if (nNode) {
              let unwrapped = nNode;
              while (unwrapped.type === 'ParenthesisNode') {
                unwrapped = (unwrapped as math.ParenthesisNode).content;
              }
              if (unwrapped.type === 'ConstantNode' && (unwrapped as math.ConstantNode).value === 2) {
                continue; // Skip offering nthRoot rule if index is 2 (handled by square root)
              }
            }
          }

          const instantiated = instantiatePattern(rule.targetPattern, bindings);
          const newEq = replaceNodeAtPath(eq, path, instantiated);
          if (areEquationsEquivalent(eq, newEq)) {
            rawReductions.push({
              path,
              simplified: newEq,
              type: 'identity',
              label: rule.name
            });
          }
        }
      }
    } catch {}

    // Try factoring univariate integer polynomials (GCF extraction, quadratics).
    // Each candidate is validated against the source before being offered.
    try {
      const node = getNodeByPath(eq, path);
      const clean = (s: string) => s.replace(/[\s()]/g, '');

      // Detect an additive fragment: a node that is one term of a larger +/- sum.
      // Pulling a GCF out of such a fragment (e.g. x*(x+5)+6 from x^2+5x+6) is
      // pedagogical noise, so suppress partial GCF there — the whole expression
      // still offers its own factorings.
      let additiveFragment = false;
      if (path.includes('/')) {
        try {
          const parent = getNodeByPath(eq, path.slice(0, path.lastIndexOf('/')));
          additiveFragment =
            parent.type === 'OperatorNode' && ['+', '-'].includes((parent as math.OperatorNode).op);
        } catch {}
      }

      for (const factored of tryFactor(node)) {
        if (additiveFragment && factored.label.startsWith('Factor out')) continue; // partial GCF
        const newEq = replaceNodeAtPath(eq, path, factored.node);
        if (clean(factored.node.toString()) === clean(node.toString())) continue; // no-op
        if (areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({ path, simplified: newEq, type: 'factor', label: factored.label });
        }
      }
    } catch {}

    // Try completing the square on a quadratic expression (x²+6x+5 -> (x+3)²-4).
    // An identity rewrite offered in place, so it works on a bare quadratic, on
    // `... = 0`, and on the RHS of `y = ...` (vertex form for graphing) — #62.
    try {
      const node = getNodeByPath(eq, path);
      const completed = tryCompleteTheSquare(node);
      if (completed) {
        const newEq = replaceNodeAtPath(eq, path, completed);
        const clean = (s: string) => s.replace(/[\s()]/g, '');
        if (clean(completed.toString()) !== clean(node.toString()) && areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({ path, simplified: newEq, type: 'identity', label: 'Complete the Square' });
        }
      }
    } catch {}

    // Try expressing perfect power constants (e.g. 9 -> 3^2, 8 -> 2^3, 64 -> 8^2, 4^3, 2^6).
    // Skipped on a radicand: under a sqrt/nthRoot, expressing 8 as 2^3 is a misfit
    // suggestion competing with simplifying the radical itself (sqrt(8) -> 2√2) — #66.
    try {
      const node = getNodeByPath(eq, path);
      const powerForms = isRadicandOfRoot(eq, path) ? [] : tryExpressAsPowerOptions(node);
      for (const powerForm of powerForms) {
        const newEq = replaceNodeAtPath(eq, path, powerForm);
        if (areEquationsEquivalent(eq, newEq)) {
          const exponent = ((powerForm as math.OperatorNode).args[1] as math.ConstantNode).value;
          const label = exponent === 2
            ? 'Express as Square'
            : exponent === 3
              ? 'Express as Cube'
              : `Express as ${exponent}th Power`;
          rawReductions.push({
            path,
            simplified: newEq,
            type: 'identity',
            label
          });
        }
      }
    } catch {}

    // Try combining a sum/difference of fractions over a common denominator (#61).
    // Offered only on the maximal additive chain (parent is not itself +/-), so
    // a 3-way sum gets one handle on the whole thing, not one per nested sub-sum.
    try {
      const node = getNodeByPath(eq, path);
      let parentIsAdditive = false;
      if (path.includes('/')) {
        try {
          const parent = getNodeByPath(eq, path.slice(0, path.lastIndexOf('/')));
          parentIsAdditive =
            parent.type === 'OperatorNode' && ['+', '-'].includes((parent as math.OperatorNode).op);
        } catch {}
      }
      if (!parentIsAdditive) {
        const combined = tryCombineFractions(node);
        if (combined) {
          const clean = (s: string) => s.replace(/[\s()]/g, '');
          if (clean(combined.toString()) !== clean(node.toString())) {
            const newEq = replaceNodeAtPath(eq, path, combined);
            if (areEquationsEquivalent(eq, newEq)) {
              rawReductions.push({ path, simplified: newEq, type: 'reduce', label: 'Combine Fractions' });
            }
          }
        }
      }
    } catch {}

    // Try expanding power terms (e.g. x^2 -> x * x, x^3 -> x * x * x)
    try {
      const node = getNodeByPath(eq, path);
      const expandedForm = tryExpandPowerTerm(node);
      if (expandedForm) {
        const newEq = replaceNodeAtPath(eq, path, expandedForm);
        if (areEquationsEquivalent(eq, newEq)) {
          rawReductions.push({
            path,
            simplified: newEq,
            type: 'expand',
            label: 'Expand Power'
          });
        }
      }
    } catch {}
  });

  // Try equation-level quadratic formula solutions
  try {
    const quadSolutions = getQuadraticFormulaSolutions(eq);
    for (const sol of quadSolutions) {
      const hasVarOnLhs = (() => {
        let found = false;
        eq.lhs.traverse((n) => {
          if (n.type === 'SymbolNode' && (n as math.SymbolNode).name === sol.solveVar) found = true;
        });
        return found;
      })();
      const solvePath = hasVarOnLhs ? 'lhs' : 'rhs';

      // #90: when the equation isn't already in `= 0` standard form, surface the
      // normalization (→ a·v² + b·v + c = 0) as its own inspectable step instead
      // of jumping straight to the solution and hiding where a, b, c come from.
      // The ± formula is then offered on the resulting standard form — the chain
      // falls out of re-running options on the normalized equation.
      const standardForm = getQuadraticStandardForm(eq, sol.solveVar);
      if (standardForm) {
        rawReductions.push({
          path: solvePath,
          simplified: standardForm,
          type: 'identity',
          label: 'Write in Standard Form'
        });
        continue;
      }

      rawReductions.push({
        path: solvePath,
        simplified: sol.pos,
        type: 'identity',
        label: `Apply Quadratic Formula (+)`
      });

      rawReductions.push({
        path: solvePath,
        simplified: sol.neg,
        type: 'identity',
        label: `Apply Quadratic Formula (-)`
      });
    }
  } catch (err) {
    console.error('Error adding quadratic formula reductions:', err);
  }

  // An even root of a matching power loses the sign (sqrt(x^2) = |x|), so offer
  // it as a ± branch — two options the user can branch the history on — rather
  // than silently collapsing to the positive root (#45). Odd roots are sign-safe
  // and handled by the normal simplify path.
  allNodePaths.forEach((path) => {
    try {
      const analysis = analyzeRootOfPower(getNodeByPath(eq, path));
      if (!analysis || !analysis.even) return;
      const posEq = replaceNodeAtPath(eq, path, analysis.base.clone());
      const negEq = replaceNodeAtPath(
        eq,
        path,
        new mjs.OperatorNode('-', 'unaryMinus', [analysis.base.clone()]),
      );
      rawReductions.push({ path, simplified: posEq, type: 'reduce', label: 'Take Root (+)' });
      rawReductions.push({ path, simplified: negEq, type: 'reduce', label: 'Take Root (-)' });
    } catch {
      /* skip paths that fail to resolve */
    }
  });

  // Deduplicate and group
  const reduciblePaths: Record<string, ReductionOption[]> = {};
  const simplifiedToStringMap = new Map<string, ReductionOption[]>();

  const getCanonicalKey = (eqVal: Equation): string => {
    return `${eqVal.lhs.toString()} = ${eqVal.rhs.toString()}`;
  };

  rawReductions.forEach((red) => {
    const eqStrKey = getCanonicalKey(red.simplified);
    if (!simplifiedToStringMap.has(eqStrKey)) {
      simplifiedToStringMap.set(eqStrKey, []);
    }
    simplifiedToStringMap.get(eqStrKey)!.push(red);
  });

  simplifiedToStringMap.forEach((reds, _) => {
    reds.sort((a, b) => {
      const nodeA = getNodeByPath(eq, a.path);
      const nodeB = getNodeByPath(eq, b.path);
      
      const isOpA = nodeA.type === 'OperatorNode' || nodeA.type === 'FunctionNode';
      const isOpB = nodeB.type === 'OperatorNode' || nodeB.type === 'FunctionNode';
      
      if (isOpA && !isOpB) return -1;
      if (!isOpA && isOpB) return 1;
      
      const depthDiff = b.path.split('/').length - a.path.split('/').length;
      if (depthDiff !== 0) return depthDiff;

      if (a.label && !b.label) return -1;
      if (!a.label && b.label) return 1;

      if (a.label && b.label) {
        const isGenericA = a.label === 'Simplify' || a.label === 'Simplify Fraction';
        const isGenericB = b.label === 'Simplify' || b.label === 'Simplify Fraction';
        if (!isGenericA && isGenericB) return -1;
        if (isGenericA && !isGenericB) return 1;
      }

      return 0;
    });
    
    const bestRed = reds[0];
    if (!reduciblePaths[bestRed.path]) {
      reduciblePaths[bestRed.path] = [];
    }
    reduciblePaths[bestRed.path].push(bestRed);
  });

  // Suppress generic "Simplify" / "Simplify Fraction" options when a more
  // specific/precise reduction/transposition is available on the same path.
  const GENERIC_LABELS = new Set(['Simplify', 'Simplify Fraction']);
  Object.keys(reduciblePaths).forEach((path) => {
    const list = reduciblePaths[path];
    const hasSpecific = list.some((r) => {
      if (!r.label) return false;
      const l = r.label;
      return (
        l.startsWith('Factor') ||
        l.startsWith('Take Root') ||
        l === 'Complete the Square' ||
        l === 'Simplify Radical' ||
        l === 'Combine Like Radicals' ||
        l === 'Rationalize Denominator' ||
        l === 'Combine Fractions'
      );
    });
    if (hasSpecific) {
      reduciblePaths[path] = list.filter((r) => !r.label || !GENERIC_LABELS.has(r.label));
    }
  });

  // De-emphasize "Evaluate to Decimal" so an exact-form move is always the
  // headline (#66): decimal is a separate, opt-in step, never the primary one.
  // Stable partition — sink it to the bottom of each node's list while keeping
  // the relative order of every other option intact.
  Object.keys(reduciblePaths).forEach((path) => {
    const list = reduciblePaths[path];
    const decimals = list.filter((r) => r.label === 'Evaluate to Decimal');
    if (decimals.length === 0 || decimals.length === list.length) return;
    reduciblePaths[path] = [
      ...list.filter((r) => r.label !== 'Evaluate to Decimal'),
      ...decimals,
    ];
  });

  return reduciblePaths;
};
