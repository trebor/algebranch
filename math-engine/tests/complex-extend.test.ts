// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation, getReducibleOptions, areEquationsEquivalent } from '../src';
import { tryExtendToComplex } from '../src/simplify';
import { mjs } from '../src/mathjs';

/** Find any reduction option (with its label) anywhere in the reducible paths. */
const findOption = (eqStr: string, predicate: (label?: string) => boolean) => {
  const eq = parseEquation(eqStr);
  const reductions = getReducibleOptions(eq);
  for (const path of Object.keys(reductions)) {
    const opt = reductions[path].find((r) => predicate(r.label));
    if (opt) return { eq, opt };
  }
  return { eq, opt: undefined };
};

const findExtend = (eqStr: string) => findOption(eqStr, (l) => l === 'Extend to ℂ');

// The "extend to ℂ" doorway (#105): a square root of a negative has no real
// value, so we offer resolving it to imaginary form √−A → √A·ⅈ.
describe('extend to ℂ — sqrt of a negative', () => {
  describe('tryExtendToComplex (unit)', () => {
    const extend = (expr: string) => {
      const out = tryExtendToComplex(mjs.parse(expr));
      return out ? out.toString() : null;
    };

    test('pulls the imaginary unit out of a negative square root', () => {
      expect(extend('sqrt(-4)')).toBe('sqrt(4) * ⅈ');
      expect(extend('sqrt(-8)')).toBe('sqrt(8) * ⅈ');
      expect(extend('sqrt(-11)')).toBe('sqrt(11) * ⅈ');
    });

    test('collapses √−1 straight to ⅈ (no degenerate √1 intermediate)', () => {
      expect(extend('sqrt(-1)')).toBe('ⅈ');
    });

    test('returns null for a non-negative radicand (nothing to extend)', () => {
      expect(extend('sqrt(4)')).toBeNull();
      expect(extend('sqrt(2)')).toBeNull();
      expect(extend('sqrt(0)')).toBeNull();
    });

    test('returns null for a non-sqrt node', () => {
      expect(extend('-4')).toBeNull();
      expect(extend('x + 1')).toBeNull();
    });
  });

  describe('surfaced as an "Extend to ℂ" reducible move', () => {
    test('offers the move on a negative square root', () => {
      const { opt } = findExtend('x = sqrt(-4)');
      expect(opt).toBeDefined();
      expect(opt!.simplified.rhs.toString()).toBe('sqrt(4) * ⅈ');
    });

    test('offers √−1 → ⅈ directly on a unit radicand', () => {
      const { opt } = findExtend('x = sqrt(-1)');
      expect(opt).toBeDefined();
      expect(opt!.simplified.rhs.toString()).toBe('ⅈ');
    });

    test('the move preserves equivalence (√−4 and √4·ⅈ are the same value)', () => {
      const { eq, opt } = findExtend('x = sqrt(-4)');
      expect(opt).toBeDefined();
      expect(areEquationsEquivalent(eq, opt!.simplified)).toBe(true);
    });

    test('is NOT offered when the radicand is non-negative', () => {
      expect(findExtend('x = sqrt(4)').opt).toBeUndefined();
      expect(findExtend('x = sqrt(x + 1)').opt).toBeUndefined();
    });

    test('the extracted √4·ⅈ can then be simplified toward 2·ⅈ (granular steps)', () => {
      // After extending, the residual real radical √4 is a normal simplify target.
      const extended = parseEquation('x = sqrt(4) * ⅈ');
      const reductions = getReducibleOptions(extended);
      const hasSimplify = Object.values(reductions)
        .flat()
        .some((r) => r.label === 'Simplify' || r.label === 'Simplify Radical' || r.label === 'Simplify Fraction');
      expect(hasSimplify).toBe(true);
    });
  });
});
