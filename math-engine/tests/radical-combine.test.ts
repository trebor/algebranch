import { parseEquation, getReducibleOptions, equationToString } from '../src';
import { tryCombineLikeRadicals } from '../src/simplify';
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

const findCombine = (eqStr: string) => findOption(eqStr, (l) => l === 'Combine Like Radicals');

describe('Combine like radicals (#66, Deliverable 2)', () => {
  describe('tryCombineLikeRadicals (unit)', () => {
    const combine = (expr: string) => {
      const out = tryCombineLikeRadicals(math.parse(expr));
      return out ? out.toString() : null;
    };

    test('adds two equal radicals', () => {
      expect(combine('sqrt(2) + sqrt(2)')).toBe('2 * sqrt(2)');
      expect(combine('sqrt(3) + sqrt(3)')).toBe('2 * sqrt(3)');
    });

    test('combines coefficients of like radicals', () => {
      expect(combine('3 * sqrt(2) - sqrt(2)')).toBe('2 * sqrt(2)');
      expect(combine('2 * sqrt(3) + 5 * sqrt(3)')).toBe('7 * sqrt(3)');
      expect(combine('sqrt(2) + 2 * sqrt(2)')).toBe('3 * sqrt(2)');
    });

    test('handles a radical with a trailing coefficient', () => {
      expect(combine('sqrt(5) * 4 + sqrt(5)')).toBe('5 * sqrt(5)');
    });

    test('combines like nth-roots (same radicand and degree)', () => {
      expect(combine('nthRoot(2, 3) + nthRoot(2, 3)')).toBe('2 * nthRoot(2, 3)');
      expect(combine('5 * nthRoot(7, 3) - 2 * nthRoot(7, 3)')).toBe('3 * nthRoot(7, 3)');
    });

    test('cancelling pair collapses to 0', () => {
      expect(combine('sqrt(2) - sqrt(2)')).toBe('0');
      expect(combine('3 * sqrt(2) - 3 * sqrt(2)')).toBe('0');
    });

    test('unit and negative-unit coefficients drop to the bare radical', () => {
      expect(combine('3 * sqrt(2) - 2 * sqrt(2)')).toBe('sqrt(2)');
      expect(combine('sqrt(2) - 2 * sqrt(2)')).toBe('-sqrt(2)');
    });

    test('leaves unlike radicals untouched', () => {
      expect(combine('sqrt(2) + sqrt(3)')).toBeNull();
      expect(combine('2 * sqrt(2) - 3 * sqrt(5)')).toBeNull();
      // same radicand, different degree are NOT like radicals
      expect(combine('sqrt(2) + nthRoot(2, 3)')).toBeNull();
    });

    test('returns null for non-radical sums', () => {
      expect(combine('x + x')).toBeNull();
      expect(combine('2 + 3')).toBeNull();
      expect(combine('sqrt(2) * sqrt(2)')).toBeNull();
    });
  });

  describe('offered as an inline "Combine Like Radicals" handle', () => {
    test('sqrt(2) + sqrt(2) offers the exact combined term, not a decimal', () => {
      const { opt } = findCombine('x = sqrt(2) + sqrt(2)');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('x = 2 * sqrt(2)');
    });

    test('3*sqrt(2) - sqrt(2) combines to 2*sqrt(2)', () => {
      const { opt } = findCombine('x = 3 * sqrt(2) - sqrt(2)');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('x = 2 * sqrt(2)');
    });

    test('the combine handle is exact, never a decimal collapse', () => {
      // A decimal is only ever offered under the explicit, opt-in "Evaluate to
      // Decimal" label — the default simplification must stay exact (#66). The
      // mathjs fallback would otherwise fold sqrt(2)+sqrt(2) to 2.83.
      const eq = parseEquation('x = sqrt(2) + sqrt(2)');
      const reductions = getReducibleOptions(eq);
      const decimalGenerics = Object.values(reductions)
        .flat()
        .filter((r) => r.label === 'Simplify' || r.label === 'Combine Like Radicals')
        .map((r) => equationToString(r.simplified))
        .filter((s) => /\d\.\d/.test(s));
      expect(decimalGenerics).toEqual([]);
    });

    test('unlike radicals offer no combine handle', () => {
      const { opt } = findCombine('x = sqrt(2) + sqrt(3)');
      expect(opt).toBeUndefined();
    });
  });
});
