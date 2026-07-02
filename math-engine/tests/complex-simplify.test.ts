// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation, getReducibleOptions, areEquationsEquivalent } from '../src';
import { trySimplifyComplexConstant } from '../src/simplify';
import { mjs } from '../src/mathjs';

const fold = (expr: string) => trySimplifyComplexConstant(mjs.parse(expr));
const simp = (expr: string) => {
  const out = fold(expr);
  return out ? out.node.toString() : null;
};
const labelOf = (expr: string) => {
  const out = fold(expr);
  return out ? out.label : null;
};

const findSimplify = (eqStr: string, resultRhs: string) => {
  const eq = parseEquation(eqStr);
  const reductions = getReducibleOptions(eq);
  for (const path of Object.keys(reductions)) {
    const opt = reductions[path].find((r) => r.simplified.rhs.toString() === resultRhs);
    if (opt) return { eq, opt };
  }
  return { eq, opt: undefined };
};

// Folding a constant subtree that contains ⅈ into a + b·ⅈ standard form (#105):
// the minimal complex-arithmetic simplification — ⅈ² → −1 and combining like
// terms, so an expression like ⅈ·3·ⅈ resolves to its value.
describe('simplify a constant ℂ-subtree to standard form', () => {
  describe('trySimplifyComplexConstant (unit)', () => {
    test('folds ⅈ² to a real', () => {
      expect(simp('ⅈ * ⅈ')).toBe('-1');
      expect(simp('ⅈ * 3 * ⅈ')).toBe('-3');
      expect(simp('ⅈ^2')).toBe('-1');
    });

    test('powers of ⅈ cycle', () => {
      expect(simp('ⅈ^3')).toBe('-ⅈ');
      expect(simp('ⅈ^4')).toBe('1');
    });

    test('combines like imaginary terms', () => {
      expect(simp('2 * ⅈ + 3 * ⅈ')).toBe('5 * ⅈ');
    });

    test('produces a + b·ⅈ standard form for a mixed value', () => {
      // (1 + ⅈ)·(1 + ⅈ) = 2ⅈ ; (2 + ⅈ)·(1 + ⅈ) = 1 + 3ⅈ
      expect(simp('(2 + ⅈ) * (1 + ⅈ)')).toBe('1 + 3 * ⅈ');
      expect(simp('(1 - 2 * ⅈ) * (1 + ⅈ)')).toBe('3 - ⅈ');
    });

    test('does not fire on a bare ⅈ or a pure real constant', () => {
      expect(simp('ⅈ')).toBeNull();
      expect(simp('3 * ⅈ')).toBeNull(); // already standard, no ⅈ collapse
      expect(simp('2 + 3')).toBeNull(); // no ⅈ — handled by ordinary simplify
    });

    test('does not fire when there is a free variable', () => {
      expect(simp('x * ⅈ')).toBeNull();
    });

    test('routes a decimal result through "Evaluate to Decimal", never "Simplify"', () => {
      // 5·ⅈ/3 = 1.666…·ⅈ decimalizes the exact 5/3 — that is the decimal
      // evaluation, so it must carry the gated label, not "Simplify". (#105)
      expect(labelOf('5 * ⅈ / 3')).toBe('Evaluate to Decimal');
      expect(labelOf('ⅈ / 3')).toBe('Evaluate to Decimal');
    });

    test('an exact (integer) fold is a plain "Simplify"', () => {
      expect(labelOf('ⅈ * 3 * ⅈ')).toBe('Simplify');
      expect(labelOf('2 * ⅈ + 3 * ⅈ')).toBe('Simplify');
      // A fraction that reduces to an integer coefficient stays exact.
      expect(simp('10 * ⅈ / 2')).toBe('5 * ⅈ');
      expect(labelOf('10 * ⅈ / 2')).toBe('Simplify');
    });
  });

  describe('surfaced as a reducible move', () => {
    test('offers ⅈ·3·ⅈ → −3 on the reported equation', () => {
      const { eq, opt } = findSimplify('x * 3 * ⅈ = ⅈ * 3 * ⅈ', '-3');
      expect(opt).toBeDefined();
      expect(opt!.label).toBe('Simplify');
      expect(areEquationsEquivalent(eq, opt!.simplified)).toBe(true);
    });

    test('offers 5·ⅈ/3 as a gated "Evaluate to Decimal" move', () => {
      // So the decimal setting governs it exactly like a real decimal eval — the
      // UI hides it when decimals are off and shows it when they are on. (#105)
      const eq = parseEquation('x = 5 * ⅈ / 3');
      const reductions = getReducibleOptions(eq);
      const opt = Object.values(reductions).flat().find((r) => r.label === 'Evaluate to Decimal');
      expect(opt).toBeDefined();
      expect(areEquationsEquivalent(eq, opt!.simplified)).toBe(true);
      // ...and none of the offered moves decimalize under a "Simplify" label.
      const simplifyDecimals = Object.values(reductions)
        .flat()
        .filter((r) => r.label === 'Simplify' && /\d\.\d/.test(r.simplified.rhs.toString()));
      expect(simplifyDecimals).toEqual([]);
    });
  });
});
