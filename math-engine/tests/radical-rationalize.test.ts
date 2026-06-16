import { parseEquation, getReducibleOptions, equationToString } from '../src';
import { tryRationalizeDenominator } from '../src/simplify';
import * as math from 'mathjs';

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

const findRationalize = (eqStr: string) =>
  findOption(eqStr, (l) => l === 'Rationalize Denominator');

describe('Rationalize radical denominators (#66, Deliverable 3)', () => {
  describe('tryRationalizeDenominator (unit)', () => {
    const rat = (expr: string) => {
      const out = tryRationalizeDenominator(math.parse(expr));
      return out ? out.toString() : null;
    };

    test('rationalizes a bare square-root denominator', () => {
      expect(rat('1 / sqrt(2)')).toBe('sqrt(2) / 2');
      expect(rat('1 / sqrt(3)')).toBe('sqrt(3) / 3');
      expect(rat('1 / sqrt(5)')).toBe('sqrt(5) / 5');
    });

    test('carries an integer numerator coefficient', () => {
      expect(rat('3 / sqrt(2)')).toBe('3 * sqrt(2) / 2');
      expect(rat('5 / sqrt(3)')).toBe('5 * sqrt(3) / 3');
    });

    test('handles an integer coefficient on the denominator radical', () => {
      expect(rat('1 / (2 * sqrt(3))')).toBe('sqrt(3) / 6');
      expect(rat('1 / (sqrt(3) * 2)')).toBe('sqrt(3) / 6');
    });

    test('reduces the resulting numeric fraction', () => {
      // 2/√2 = √2,  4/√8 = 4/(2√2) = 2/√2 = √2
      expect(rat('2 / sqrt(2)')).toBe('sqrt(2)');
      expect(rat('4 / sqrt(8)')).toBe('sqrt(2)');
      expect(rat('6 / sqrt(2)')).toBe('3 * sqrt(2)');
    });

    test('simplifies a non-square-free radicand first (reuses extraction)', () => {
      expect(rat('1 / sqrt(8)')).toBe('sqrt(2) / 4');
      expect(rat('1 / sqrt(12)')).toBe('sqrt(3) / 6');
    });

    test('rationalizes an n-th root denominator', () => {
      expect(rat('1 / nthRoot(2, 3)')).toBe('nthRoot(4, 3) / 2');
      expect(rat('1 / nthRoot(3, 3)')).toBe('nthRoot(9, 3) / 3');
    });

    test('treats a 1-arg nthRoot as a square root', () => {
      // nthRoot(2) is the degree-2 default, equivalent to sqrt(2).
      expect(rat('1 / nthRoot(2)')).toBe('sqrt(2) / 2');
    });

    test('multiplies a non-constant numerator through', () => {
      expect(rat('x / sqrt(2)')).toBe('x * sqrt(2) / 2');
    });

    test('returns null when there is no radical to rationalize', () => {
      expect(rat('1 / 2')).toBeNull();
      expect(rat('1 / sqrt(4)')).toBeNull(); // perfect square -> 1/2, no radical
      expect(rat('1 / sqrt(9)')).toBeNull();
      expect(rat('1 / x')).toBeNull();
      expect(rat('sqrt(2) / 2')).toBeNull(); // already rationalized
    });

    test('returns null for non-integer radicands (scoped to numeric radicals)', () => {
      expect(rat('1 / sqrt(x)')).toBeNull(); // symbolic radicand — out of scope
      expect(rat('1 / sqrt(1.5)')).toBeNull(); // non-integer radicand
      expect(rat('1 / nthRoot(2, n)')).toBeNull(); // non-constant degree
    });

    test('returns null for non-fraction or conjugate-style denominators', () => {
      expect(rat('sqrt(2)')).toBeNull();
      expect(rat('1 + sqrt(2)')).toBeNull();
      expect(rat('1 / (sqrt(2) + 1)')).toBeNull(); // conjugate case is out of scope
    });
  });

  describe('offered as an inline "Rationalize Denominator" handle', () => {
    test('1/sqrt(2) offers the exact rationalized form, not a decimal', () => {
      const { opt } = findRationalize('x = 1 / sqrt(2)');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('x = sqrt(2) / 2');
    });

    test('1/(2*sqrt(3)) rationalizes to sqrt(3)/6', () => {
      const { opt } = findRationalize('y = 1 / (2 * sqrt(3))');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('y = sqrt(3) / 6');
    });

    test('the rationalize handle is exact, never a decimal collapse', () => {
      // A decimal is only ever offered under the explicit, opt-in "Evaluate to
      // Decimal" label — the default simplification must stay exact (#66). The
      // mathjs fallback would otherwise fold 1/sqrt(2) to 0.707.
      const eq = parseEquation('x = 1 / sqrt(2)');
      const reductions = getReducibleOptions(eq);
      const exactLabels = Object.values(reductions)
        .flat()
        .filter((r) => r.label === 'Simplify' || r.label === 'Rationalize Denominator')
        .map((r) => equationToString(r.simplified))
        .filter((s) => /\d\.\d/.test(s));
      expect(exactLabels).toEqual([]);
    });

    test('a denominator with no radical offers no rationalize handle', () => {
      const { opt } = findRationalize('x = 1 / 2');
      expect(opt).toBeUndefined();
    });
  });
});
