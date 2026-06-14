import * as math from 'mathjs';

/**
 * Factoring of univariate integer-coefficient polynomials (Phase 1: GCF
 * extraction + monic quadratics, which also covers x^2 - c difference-of-squares
 * cases). Every candidate returned here is independently re-validated against the
 * source by the equivalence engine in `getReducibleOptions`, so this module only
 * needs to produce *plausible* nicer forms — correctness is guaranteed downstream.
 */

const MAX_CONST = 100000; // guard the divisor search against pathological inputs

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
  const node = math.parse(`${prefix} * (${polyToString(reduced, v)})`);
  return { node, label: `Factor out ${prefix.replace('*', '')}` };
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
      return { node: math.parse(`${binomial(v, p)} * ${binomial(v, q)}`), label: 'Factor' };
    }
  }
  return null;
};

/**
 * Returns candidate factored forms of a node. Empty unless the node is a
 * univariate polynomial with integer coefficients. Candidates are not yet
 * equivalence-checked — callers must validate before offering them.
 */
export const tryFactor = (node: math.MathNode): FactorOption[] => {
  let coeffs: number[];
  try {
    const detailed = math.rationalize(node, {}, true) as unknown as { coefficients: number[] };
    coeffs = detailed.coefficients;
  } catch {
    return [];
  }
  if (!Array.isArray(coeffs) || coeffs.length < 2) return [];
  if (!coeffs.every((c) => typeof c === 'number' && Number.isInteger(c))) return [];

  const vars = variablesIn(node);
  if (vars.length !== 1) return []; // Phase 1: univariate only
  const v = vars[0];

  const options: FactorOption[] = [];
  const gcf = gcfFactor(coeffs, v);
  if (gcf) options.push(gcf);
  const quad = monicQuadratic(coeffs, v);
  if (quad) options.push(quad);
  return options;
};
