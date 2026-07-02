// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation, getReducibleOptions, areEquationsEquivalent } from '../src';
import { tryRationalizeComplexDenominator } from '../src/simplify';
import { mjs } from '../src/mathjs';

const rat = (expr: string) => {
  const out = tryRationalizeComplexDenominator(mjs.parse(expr));
  return out ? out.toString() : null;
};

// Conjugate rationalization of a complex denominator (#105, Slice B): multiply
// through by a − b·ⅈ to clear ⅈ from the denominator, parallel to the real
// radical rationalizer.
describe('rationalize a complex denominator', () => {
  describe('tryRationalizeComplexDenominator (unit)', () => {
    test('clears the imaginary unit via the conjugate', () => {
      expect(rat('1 / (2 + ⅈ)')).toBe('(2 - ⅈ) / 5');
      expect(rat('1 / (1 + ⅈ)')).toBe('(1 - ⅈ) / 2');
      expect(rat('1 / (3 - 2 * ⅈ)')).toBe('(3 + 2 * ⅈ) / 13');
    });

    test('reduces the result to lowest terms', () => {
      expect(rat('5 / (2 + ⅈ)')).toBe('2 - ⅈ'); // 5(2−ⅈ)/5
      expect(rat('1 / (2 + 2 * ⅈ)')).toBe('(1 - ⅈ) / 4');
    });

    test('handles a pure-imaginary denominator', () => {
      expect(rat('1 / ⅈ')).toBe('-ⅈ');
      expect(rat('1 / (2 * ⅈ)')).toBe('-ⅈ / 2');
    });

    test('returns null when there is nothing to rationalize', () => {
      expect(rat('1 / 5')).toBeNull(); // real denominator
      expect(rat('1 / sqrt(2)')).toBeNull(); // real radical — the other rationalizer
      expect(rat('1 / (x + ⅈ)')).toBeNull(); // variable denominator
      expect(rat('(2 + ⅈ) / 3')).toBeNull(); // real denominator, complex numerator
    });
  });

  describe('surfaced as a reducible move', () => {
    test('offers "Rationalize Denominator" on 1/(2+ⅈ) → (2−ⅈ)/5', () => {
      const eq = parseEquation('x = 1 / (2 + ⅈ)');
      const reductions = getReducibleOptions(eq);
      const opt = Object.values(reductions)
        .flat()
        .find((r) => r.label === 'Rationalize Denominator');
      expect(opt).toBeDefined();
      expect(opt!.simplified.rhs.toString()).toBe('(2 - ⅈ) / 5');
      expect(areEquationsEquivalent(eq, opt!.simplified)).toBe(true);
    });
  });
});
