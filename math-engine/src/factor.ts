// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs } from './mathjs';

/**
 * Factoring of univariate integer-coefficient polynomials (Phase 1: GCF
 * extraction + monic quadratics, which also covers x^2 - c difference-of-squares
 * cases). Every candidate returned here is independently re-validated against the
 * source by the equivalence engine in `getReducibleOptions`, so this module only
 * needs to produce *plausible* nicer forms — correctness is guaranteed downstream.
 */

const MAX_CONST = 100000; // guard the divisor search against pathological inputs

// Cap on a product root's multiplied-out term count before we hand it to mathjs
// `rationalize` (see `expansionTerms`). Rationalize's cost grows explosively with
// the expanded term count — measured ~36 ms at 8 terms, ~600 ms at 16, and it
// hangs at 32 (#406). This is *purely* a performance guard; what we choose to
// offer is governed separately by the `factorCount` de-factoring invariant.
const MAX_EXPANSION_TERMS = 8;

/**
 * Upper bound on the number of terms `node` expands to when multiplied out — the
 * cost metric that keeps product roots away from the mathjs `rationalize` blowup
 * behind #406. Cost is multiplicative across `*` factors and additive across
 * `+`/`-` terms; a monomial or atomic-base power (`x`, `x^3`) is one term, while
 * a power of a *compound* base (`(x-1)^2`) and any non-polynomial shape (division,
 * functions) expand pathologically and count as unbounded.
 */
const expansionTerms = (node: math.MathNode): number => {
  switch (node.type) {
    case 'ParenthesisNode':
      return expansionTerms((node as math.ParenthesisNode).content);
    case 'ConstantNode':
    case 'SymbolNode':
      return 1;
    case 'OperatorNode': {
      const on = node as math.OperatorNode;
      if (on.op === '*') return on.args.reduce((p, a) => p * expansionTerms(a), 1);
      if (on.op === '+' || on.op === '-') return on.args.reduce((s, a) => s + expansionTerms(a), 0);
      if (on.op === '^') {
        let base = on.args[0];
        while (base.type === 'ParenthesisNode') base = (base as math.ParenthesisNode).content;
        return base.type === 'SymbolNode' || base.type === 'ConstantNode' ? 1 : Infinity;
      }
      return Infinity; // division and other operators are not a polynomial product
    }
    default:
      return Infinity; // FunctionNode, etc.
  }
};

/**
 * Number of top-level multiplicative factors of `node`: parentheses unwrapped,
 * nested `*` flattened, a non-product counting as 1. `tryFactor` uses this to
 * enforce the #424 invariant — never surface a candidate that is *less* factored
 * than its source (e.g. expanding an already-factored product back into a
 * polynomial, or a lateral re-order). It is deliberately kept separate from the
 * #406 hang guard above so that a future "safely rationalize products" change
 * cannot quietly reintroduce the de-factoring offer.
 */
export const factorCount = (node: math.MathNode): number => {
  let n = node;
  while (n.type === 'ParenthesisNode') n = (n as math.ParenthesisNode).content;
  if (n.type === 'OperatorNode' && (n as math.OperatorNode).op === '*') {
    return (n as math.OperatorNode).args.reduce((sum, a) => sum + factorCount(a), 0);
  }
  return 1;
};

export interface FactorOption {
  readonly node: math.MathNode;
  readonly label: string;
}

const gcd2 = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};

const arrayGcd = (nums: number[]): number => nums.reduce((g, n) => gcd2(g, n), 0);

/** Distinct variable symbol names appearing anywhere in the node. */
const variablesIn = (node: math.MathNode): string[] => {
  const names = new Set<string>();
  node.traverse((n) => {
    if (n.type === 'SymbolNode') names.add((n as math.SymbolNode).name);
  });
  return [...names];
};

/** Render ascending-power coefficients as a readable polynomial string. */
const polyToString = (coeffs: number[], v: string): string => {
  let out = '';
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (c === 0) continue;
    const mag = Math.abs(c);
    const varPart = i === 0 ? '' : i === 1 ? v : `${v}^${i}`;
    const term = i === 0 ? `${mag}` : mag === 1 ? varPart : `${mag}*${varPart}`;
    if (out === '') {
      out = c < 0 ? `-${term}` : term;
    } else {
      out += c < 0 ? ` - ${term}` : ` + ${term}`;
    }
  }
  return out || '0';
};

/** `(v + p)` with sign-aware formatting (p is the additive constant). */
const binomial = (v: string, p: number): string =>
  p < 0 ? `(${v} - ${-p})` : `(${v} + ${p})`;

/**
 * Greatest-common-factor extraction: pull out `g * v^k` from a polynomial that is
 * a genuine sum of >= 2 terms, e.g. `6x^2 + 9x -> 3x(2x + 3)`.
 */
const gcfFactor = (coeffs: number[], v: string): FactorOption | null => {
  const nonzero = coeffs.map((c, i) => ({ c, i })).filter((o) => o.c !== 0);
  if (nonzero.length < 2) return null; // a single term is nothing to "factor out of"

  const k = nonzero[0].i; // lowest power present -> common v^k
  const g = arrayGcd(nonzero.map((o) => o.c)); // gcd of the coefficients
  if (g <= 1 && k === 0) return null; // nothing meaningful to extract

  const reduced = coeffs.slice(k).map((c) => c / g);
  const prefixVar = k === 0 ? '' : k === 1 ? v : `${v}^${k}`;
  const prefix = g !== 1 && prefixVar ? `${g}*${prefixVar}` : g !== 1 ? `${g}` : prefixVar;
  const node = mjs.parse(`${prefix} * (${polyToString(reduced, v)})`);
  return { node, label: `Factor out ${prefix.replace('*', '')}` };
};

/** An integer-coefficient monomial: `coeff * ∏ sym^exp`. */
interface Monomial {
  coeff: number;
  powers: Map<string, number>;
}

/**
 * Flatten an additive tree into signed leaf terms. `+` preserves the incoming
 * sign; binary `-` negates the right operand; unary `-` negates its operand.
 */
const flattenSum = (node: math.MathNode, sign: number, out: { node: math.MathNode; sign: number }[]): void => {
  let n = node;
  while (n.type === 'ParenthesisNode') n = (n as math.ParenthesisNode).content;
  if (n.type === 'OperatorNode') {
    const on = n as math.OperatorNode;
    if (on.op === '+') {
      flattenSum(on.args[0], sign, out);
      flattenSum(on.args[1], sign, out);
      return;
    }
    if (on.op === '-') {
      if (on.args.length === 2) {
        flattenSum(on.args[0], sign, out);
        flattenSum(on.args[1], -sign, out);
        return;
      }
      if (on.args.length === 1) {
        flattenSum(on.args[0], -sign, out);
        return;
      }
    }
  }
  out.push({ node: n, sign });
};

/**
 * Decompose a term into a clean integer-coefficient monomial, or `null` if it is
 * anything else (a division, a function call, a non-integer constant, a
 * compound-base power). Conservative on purpose — anything non-monomial bails the
 * whole multivariate GCF path.
 */
const monomialOf = (node: math.MathNode): Monomial | null => {
  let n = node;
  while (n.type === 'ParenthesisNode') n = (n as math.ParenthesisNode).content;

  if (n.type === 'ConstantNode') {
    const value = Number((n as math.ConstantNode).value);
    if (!Number.isInteger(value)) return null;
    return { coeff: value, powers: new Map() };
  }
  if (n.type === 'SymbolNode') {
    return { coeff: 1, powers: new Map([[(n as math.SymbolNode).name, 1]]) };
  }
  if (n.type === 'OperatorNode') {
    const on = n as math.OperatorNode;
    if (on.op === '*') {
      const acc: Monomial = { coeff: 1, powers: new Map() };
      for (const arg of on.args) {
        const m = monomialOf(arg);
        if (!m) return null;
        acc.coeff *= m.coeff;
        for (const [sym, exp] of m.powers) acc.powers.set(sym, (acc.powers.get(sym) ?? 0) + exp);
      }
      return acc;
    }
    if (on.op === '^') {
      let base = on.args[0];
      while (base.type === 'ParenthesisNode') base = (base as math.ParenthesisNode).content;
      const expNode = on.args[1];
      if (base.type !== 'SymbolNode' || expNode.type !== 'ConstantNode') return null;
      const exp = Number((expNode as math.ConstantNode).value);
      if (!Number.isInteger(exp) || exp < 1) return null;
      return { coeff: 1, powers: new Map([[(base as math.SymbolNode).name, exp]]) };
    }
    if (on.op === '-' && on.args.length === 1) {
      const m = monomialOf(on.args[0]);
      if (!m) return null;
      return { coeff: -m.coeff, powers: m.powers };
    }
  }
  return null;
};

/** Render an unsigned monomial as `mag*∏ sym^exp`, symbols sorted for determinism. */
const monomialToString = (mag: number, powers: Map<string, number>): string => {
  const factors = [...powers.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([sym, exp]) => (exp === 1 ? sym : `${sym}^${exp}`));
  if (factors.length === 0) return `${mag}`;
  return mag === 1 ? factors.join('*') : `${mag}*${factors.join('*')}`;
};

/**
 * Multivariate GCF extraction: pull the single full greatest common factor out of
 * a sum of integer-coefficient monomials, e.g. `a*c - b*c -> c*(a - b)` or
 * `6*x^2*y + 9*x*y -> 3*x*y*(2*x + 3)`. Returns at most one candidate — no
 * factor-subset enumeration, no partial per-variable pulls, no recursion — which
 * bounds the load and keeps async/worker evaluation (#437) optional. Bails on any
 * non-monomial term, and never touches mathjs `rationalize` (sidestepping the #406
 * expansion blowup entirely).
 */
const multivariateGcf = (sum: math.MathNode): FactorOption | null => {
  const rawTerms: { node: math.MathNode; sign: number }[] = [];
  flattenSum(sum, 1, rawTerms);

  const terms: Monomial[] = [];
  for (const { node, sign } of rawTerms) {
    const m = monomialOf(node);
    if (!m) return null; // a non-monomial term bails the whole path
    terms.push({ coeff: sign * m.coeff, powers: m.powers });
  }
  if (terms.length < 2) return null;

  const g = arrayGcd(terms.map((t) => t.coeff)); // positive integer content
  const gcfPowers = new Map<string, number>();
  for (const [sym, exp] of terms[0].powers) {
    let min = exp;
    for (const t of terms) {
      const e = t.powers.get(sym);
      if (e === undefined) {
        min = 0;
        break;
      }
      min = Math.min(min, e);
    }
    if (min > 0) gcfPowers.set(sym, min);
  }
  if (g <= 1 && gcfPowers.size === 0) return null; // nothing meaningful to extract

  let reduced = '';
  for (const t of terms) {
    const coeff = t.coeff / g;
    const powers = new Map<string, number>();
    for (const [sym, exp] of t.powers) {
      const rem = exp - (gcfPowers.get(sym) ?? 0);
      if (rem > 0) powers.set(sym, rem);
    }
    const termStr = monomialToString(Math.abs(coeff), powers);
    if (reduced === '') reduced = coeff < 0 ? `-${termStr}` : termStr;
    else reduced += coeff < 0 ? ` - ${termStr}` : ` + ${termStr}`;
  }

  const prefix = monomialToString(g, gcfPowers);
  const node = mjs.parse(`${prefix} * (${reduced})`);
  return { node, label: `Factor out ${prefix.replace(/\*/g, '')}` };
};

/**
 * Monic quadratic factoring: `v^2 + b*v + c -> (v + p)(v + q)` with integer
 * p + q = b, p * q = c. Also covers `v^2 - c` (difference of squares) directly.
 */
const monicQuadratic = (coeffs: number[], v: string): FactorOption | null => {
  if (coeffs.length !== 3 || coeffs[2] !== 1) return null;
  const c = coeffs[0];
  const b = coeffs[1];
  if (c === 0) return null; // v^2 + b*v = v(v + b) is handled by GCF
  if (Math.abs(c) > MAX_CONST) return null;

  for (let p = -Math.abs(c) - 1; p <= Math.abs(c) + 1; p++) {
    if (p === 0 || c % p !== 0) continue;
    const q = c / p;
    if (p + q === b) {
      return { node: mjs.parse(`${binomial(v, p)} * ${binomial(v, q)}`), label: 'Factor' };
    }
  }
  return null;
};

/**
 * Leading-coefficient quadratic factoring via the discriminant:
 * `a*v^2 + b*v + c -> (m*v + p)(n*v + q)` when the roots are rational.
 * Each root r = num/den becomes a factor `(den*v - num)`. Forms with a common
 * integer content (e.g. `2v^2 + 4v + 2`) are intentionally rejected here by the
 * downstream equivalence check — GCF extraction is the right move for those.
 */
const generalQuadratic = (coeffs: number[], v: string): FactorOption | null => {
  if (coeffs.length !== 3) return null;
  const c = coeffs[0];
  const b = coeffs[1];
  const a = coeffs[2];
  if (a === 1 || a === 0) return null; // monic handled separately
  if (c === 0) return null; // a*v^2 + b*v = v(a*v + b) is handled by GCF
  if (Math.abs(a) > MAX_CONST || Math.abs(c) > MAX_CONST) return null;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  if (!Number.isInteger(root)) return null; // irrational roots -> no clean factoring

  // r = num/den, reduced with a positive denominator -> factor (den*v - num)
  const factorFor = (num: number, den: number): { d: number; n: number } => {
    let g = gcd2(num, den) || 1;
    let n = num / g;
    let d = den / g;
    if (d < 0) {
      d = -d;
      n = -n;
    }
    return { d, n };
  };
  const f1 = factorFor(-b + root, 2 * a);
  const f2 = factorFor(-b - root, 2 * a);

  const term = ({ d, n }: { d: number; n: number }): string => {
    const xPart = d === 1 ? v : `${d}*${v}`;
    return n < 0 ? `(${xPart} + ${-n})` : `(${xPart} - ${n})`;
  };
  return { node: mjs.parse(`${term(f1)} * ${term(f2)}`), label: 'Factor' };
};

/**
 * Returns candidate factored forms of a node. Empty unless the node is a
 * univariate polynomial with integer coefficients. Candidates are not yet
 * equivalence-checked — callers must validate before offering them.
 */
export const tryFactor = (node: math.MathNode): FactorOption[] => {
  let unwrapped = node;
  while (unwrapped.type === 'ParenthesisNode') {
    unwrapped = (unwrapped as math.ParenthesisNode).content;
  }
  if (unwrapped.type !== 'OperatorNode') return [];
  const { op } = unwrapped as math.OperatorNode;
  const isSum = op === '+' || op === '-';
  const isProduct = op === '*';
  if (!isSum && !isProduct) return [];

  const vars = variablesIn(node);

  // Multivariate GCF path (sums only): a distinct term-based algorithm that never
  // touches `rationalize` (so it sidesteps the #406 blowup) and emits at most one
  // full-GCF candidate. A multivariate *product* is already a single term, so it
  // falls through to the univariate path below and is rejected there.
  if (isSum && vars.length > 1) {
    const gcf = multivariateGcf(unwrapped);
    if (!gcf) return [];
    return factorCount(gcf.node) > factorCount(unwrapped) ? [gcf] : [];
  }

  // #406 hang guard (performance only): a product can drive `rationalize` into an
  // exponential expansion blowup. Let a product through to candidate generation
  // only when its multiplied-out term count stays within budget; the pedagogy of
  // *whether* a product's candidates are worth offering is the factorCount
  // invariant below, not this guard.
  if (isProduct && expansionTerms(unwrapped) > MAX_EXPANSION_TERMS) return [];

  let coeffs: number[];
  try {
    const detailed = mjs.rationalize(unwrapped, {}, true) as unknown as { coefficients: number[] };
    coeffs = detailed.coefficients;
  } catch {
    return [];
  }
  if (!Array.isArray(coeffs) || coeffs.length < 2) return [];
  if (!coeffs.every((c) => typeof c === 'number' && Number.isInteger(c))) return [];

  if (vars.length !== 1) return []; // univariate rationalize path only
  const v = vars[0];

  const options: FactorOption[] = [];
  const gcf = gcfFactor(coeffs, v);
  if (gcf) options.push(gcf);
  const monic = monicQuadratic(coeffs, v);
  if (monic) options.push(monic);
  const general = generalQuadratic(coeffs, v);
  if (general) options.push(general);

  // #424 de-factoring invariant: only surface a candidate that is *more* factored
  // than its source. A sum is a single factor, so real sum factorings always
  // increase the count and pass; but expanding an already-factored product (e.g.
  // x*(x-1)*(x+1)*(x+2) -> x*(x^3+2x^2-x-2)) drops from 4 factors to 2 — that, and
  // no-op lateral re-orders, are rejected here rather than shown as "factoring".
  const srcFactors = factorCount(unwrapped);
  return options.filter((o) => factorCount(o.node) > srcFactors);
};
