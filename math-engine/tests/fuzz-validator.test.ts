// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Adversarial fuzz campaign against the numeric move validator (#498).
 *
 * Move validation is numeric identity testing (SPEC §4.2): interval/point
 * evaluation can prove a move *false*, never *true*. Under a public launch wave
 * (#461) someone will actively hunt for an accepted-but-wrong move — "I made it
 * do invalid algebra" is the top-comment risk for a tool whose pitch is
 * *mistake-proof*. This suite is the cheap prevention story.
 *
 * It has two halves:
 *   1. A deterministic, seeded *generative* fuzz — random equations paired with
 *      a solution-set-altering mutation (must reject) or a solution-set-
 *      preserving transformation (must accept). Seeded so CI is reproducible.
 *   2. Curated adversarial corpora frozen as named regression cases, spanning
 *      the trap families the issue calls out: domain-edge, out-of-window,
 *      tolerance-abuse, complex-gate leakage, plus a true-identity converse
 *      guard so a sampler fix can't over-tighten into false rejections.
 *
 * The realistic threat surface is the *move generator* (a user dragging terms),
 * so the final block asserts `generateValidMoves` never *offers* the classic
 * domain-collapse steps (√(x²)=k → x=k, |x|=k → x=k, x²=k → x=√k). Checking
 * offered moves with `areEquationsEquivalent` would be circular — the generator
 * accepts a move iff that function agrees — so this block asserts on the *shape*
 * of the offered set instead.
 *
 * The long-budget randomized counterpart runs from `scripts/fuzz-validator.mjs`.
 */

import { parseEquation, equationToString, getAllPaths } from '../src/index';
import { areEquationsEquivalent, generateValidMoves } from '../src/validator';

// Deterministic generative-fuzz sizing. Each iteration is a handful of Newton
// solves (~ms); a few hundred keeps the suite well under a second.
const NONEQUIV_ITERATIONS = 250;
const EQUIV_ITERATIONS = 250;
const FUZZ_SEED = 0x9e3779b9;

// Coefficient ranges for generated equations. Kept to small integers so the
// generated algebra is exactly the shape a student produces, and so a perturbed
// constant lands well above the validator's 1e-5 acceptance tolerance at the
// [1,5] sampling magnitudes — a genuine, *detectable* solution-set shift rather
// than a tolerance-edge coin flip.
const COEFF_MIN = -6;
const COEFF_MAX = 6;
const SCALE_MIN = 2;
const SCALE_MAX = 5;
const VAR_NAMES = ['x', 'y', 't', 'a'] as const;

/** mulberry32 — a tiny, fast, fully deterministic PRNG for reproducible fuzz. */
const makeRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randInt = (rng: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

const randNonZero = (rng: () => number, lo: number, hi: number): number => {
  let v = 0;
  while (v === 0) v = randInt(rng, lo, hi);
  return v;
};

const pick = <T>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];

/** Wrap every literal in parens so negative coefficients parse unambiguously. */
const lit = (n: number): string => `(${n})`;

/**
 * A random genuine linear equation `a·v + b = c` with a ≠ 0 — always a
 * conditional with a single real root, so any nonzero perturbation of one side
 * provably shifts the solution set (used by the non-equivalence generator).
 */
const makeLinear = (rng: () => number): { a: number; b: number; c: number; v: string } => ({
  a: randNonZero(rng, COEFF_MIN, COEFF_MAX),
  b: randInt(rng, COEFF_MIN, COEFF_MAX),
  c: randInt(rng, COEFF_MIN, COEFF_MAX),
  v: pick(rng, VAR_NAMES),
});

const linearStr = (a: number, b: number, c: number, v: string): string =>
  `${lit(a)}*${v} + ${lit(b)} = ${lit(c)}`;

/**
 * Generative false-accept probe: build a real linear equation and mutate it so
 * the solution set MUST change (perturb one side's constant, or the slope). The
 * validator must reject; if it accepts, that is an accepted-but-wrong move.
 */
const generateNonEquivalentPair = (rng: () => number): { s1: string; s2: string } => {
  const { a, b, c, v } = makeLinear(rng);
  const s1 = linearStr(a, b, c, v);
  const mode = randInt(rng, 0, 1);
  if (mode === 0) {
    // Perturb the RHS constant by a detectable nonzero amount.
    const d = randNonZero(rng, 1, COEFF_MAX);
    return { s1, s2: linearStr(a, b, c + d, v) };
  }
  // Perturb the slope; a ≠ a+e keeps a unique but different root.
  const e = randNonZero(rng, 1, COEFF_MAX);
  return { s1, s2: linearStr(a + e, b, c, v) };
};

/**
 * Converse guard: build a random equation and apply a solution-set-PRESERVING
 * transformation (scale both sides by a nonzero constant, add the same constant
 * to both sides, or swap sides). The validator must keep accepting these, so a
 * future sampler fix can't over-tighten into false rejections.
 */
const generateEquivalentPair = (rng: () => number): { s1: string; s2: string } => {
  const { a, b, c, v } = makeLinear(rng);
  const s1 = linearStr(a, b, c, v);
  const mode = randInt(rng, 0, 2);
  if (mode === 0) {
    const k = randNonZero(rng, SCALE_MIN, SCALE_MAX);
    // k·(a·v + b) = k·c — same root for k ≠ 0.
    return { s1, s2: `${lit(k)}*(${lit(a)}*${v} + ${lit(b)}) = ${lit(k)}*${lit(c)}` };
  }
  if (mode === 1) {
    const d = randInt(rng, COEFF_MIN, COEFF_MAX);
    // Add the same constant to both sides.
    return { s1, s2: `${lit(a)}*${v} + ${lit(b)} + ${lit(d)} = ${lit(c)} + ${lit(d)}` };
  }
  // Swap sides — trivially equivalent.
  return { s1, s2: `${lit(c)} = ${lit(a)}*${v} + ${lit(b)}` };
};

const isEquiv = (s1: string, s2: string): boolean =>
  areEquationsEquivalent(parseEquation(s1), parseEquation(s2));

describe('fuzz(#498): generative move-validator hardening', () => {
  test('never accepts a solution-set-altering mutation (no false accepts)', () => {
    const rng = makeRng(FUZZ_SEED);
    const falseAccepts: string[] = [];
    for (let i = 0; i < NONEQUIV_ITERATIONS; i++) {
      const { s1, s2 } = generateNonEquivalentPair(rng);
      if (isEquiv(s1, s2)) falseAccepts.push(`[${s1}] wrongly ≡ [${s2}]`);
    }
    expect(falseAccepts).toEqual([]);
  });

  test('never rejects a solution-set-preserving transform (no false rejects)', () => {
    const rng = makeRng(FUZZ_SEED ^ 0x55555555);
    const falseRejects: string[] = [];
    for (let i = 0; i < EQUIV_ITERATIONS; i++) {
      const { s1, s2 } = generateEquivalentPair(rng);
      if (!isEquiv(s1, s2)) falseRejects.push(`[${s1}] wrongly ≢ [${s2}]`);
    }
    expect(falseRejects).toEqual([]);
  });
});

// --- Curated adversarial corpora, frozen as named regression cases ----------

/**
 * Genuinely NON-equivalent pairs (distinct solution sets) crafted to fool
 * positive-orthant / sparse / narrow-magnitude sampling. Each MUST be rejected.
 */
const ADVERSARIAL_NON_EQUIVALENT: Array<{ name: string; a: string; b: string }> = [
  // Domain-edge traps: an identity that holds only on a sub-domain.
  { name: 'sqrt(x^2)=k drops the negative root', a: 'sqrt(x^2) = 5', b: 'x = 5' },
  { name: 'abs collapse misses the reflection', a: 'abs(x) = 4', b: 'x = 4' },
  { name: 'even power keeps both roots', a: 'x^2 = 9', b: 'x = 3' },
  { name: 'quartic vs its unsquared form', a: 'x^4 = 81', b: 'x = 3' },
  // Out-of-window divergence with a DETECTABLE (in-range) coefficient.
  { name: 'linear vs displaced linear', a: 'y = 3*x', b: 'y = 3*x + 2' },
  { name: 'zero vs product with real roots', a: 'y = 0', b: 'y = (x - 10)*(x - 11)' },
  { name: 'degree-5 poly vs zero', a: 'y = 0', b: 'y = (x-1)*(x-2)*(x-3)*(x-4)*(x-5)' },
  // Tolerance abuse at realistic magnitude (difference >> 1e-5 where sampled).
  { name: 'large-magnitude offset', a: 'y = 1000*x', b: 'y = 1000*x + 3' },
  // Complex-gate leakage: no real solution vs a different no-real-solution form.
  { name: 'negative squares differ', a: 'x^2 = -4', b: 'x^2 = -9' },
  { name: 'complex-only root not real', a: 'x^2 = -1', b: 'x = 1' },
];

describe('fuzz(#498): curated adversarial non-equivalences must be rejected', () => {
  for (const { name, a, b } of ADVERSARIAL_NON_EQUIVALENT) {
    test(`rejects: ${name}`, () => {
      expect(isEquiv(a, b)).toBe(false);
    });
  }
});

/**
 * TRUE identities / equivalences that MUST stay accepted — the converse guard.
 * A fix that tightens sampling against the traps above must not regress these.
 */
const CONVERSE_TRUE_EQUIVALENCES: Array<{ name: string; a: string; b: string }> = [
  { name: 'basic transposition', a: 'x + 2 = 5', b: 'x = 3' },
  { name: 'distribute both sides', a: '2*(x + 1) = 8', b: 'x + 1 = 4' },
  { name: 'move-square-to-rhs', a: 'x^2 - 9 = 0', b: 'x^2 = 9' },
  { name: 'quartic reduces over R', a: 'x^4 = 16', b: 'x^2 = 4' },
  { name: 'log/exp inverse (natural log)', a: 'log(e^x) = 2', b: 'x = 2' },
  { name: 'hole does not change solution set', a: 'x^2/x = 5', b: 'x = 5' },
  { name: 'scale both sides by a negative', a: 'x = 3', b: '-2*x = -6' },
];

describe('fuzz(#498): converse guard — true equivalences must stay accepted', () => {
  for (const { name, a, b } of CONVERSE_TRUE_EQUIVALENCES) {
    test(`accepts: ${name}`, () => {
      expect(isEquiv(a, b)).toBe(true);
    });
  }
});

// --- Move-generator surface: the dangerous step must never be OFFERED --------

/**
 * The real attack surface is a user dragging a term. For each trap equation the
 * offered move set must not contain the domain-collapse step. We compare against
 * the rendered RHS/LHS of every offered move rather than re-running
 * `areEquationsEquivalent` (which would be circular with the generator).
 */
const MOVE_SURFACE_TRAPS: Array<{ name: string; eq: string; forbidden: string[] }> = [
  { name: 'sqrt(x^2)=9 never offers x=9', eq: 'sqrt(x^2) = 9', forbidden: ['x = 9', 'x = 3'] },
  { name: 'x^2=9 never offers a bare-root isolation', eq: 'x^2 = 9', forbidden: ['x = 3', 'x = sqrt(9)'] },
  { name: 'abs(x)=4 never offers x=4', eq: 'abs(x) = 4', forbidden: ['x = 4'] },
];

const offeredMoveStrings = (eqStr: string): Set<string> => {
  const eq = parseEquation(eqStr);
  const out = new Set<string>();
  for (const path of getAllPaths(eq)) {
    const moves = generateValidMoves(eq, path);
    for (const key of Object.keys(moves)) out.add(equationToString(moves[key]));
  }
  return out;
};

describe('fuzz(#498): move generator never offers a domain-collapse step', () => {
  for (const { name, eq, forbidden } of MOVE_SURFACE_TRAPS) {
    test(name, () => {
      const offered = offeredMoveStrings(eq);
      for (const bad of forbidden) {
        expect(offered.has(bad)).toBe(false);
      }
    });
  }
});
