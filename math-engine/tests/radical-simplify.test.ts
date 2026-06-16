import { parseEquation, getReducibleOptions, equationToString } from '../src';
import { trySimplifyRadical } from '../src/simplify';
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

const findRadical = (eqStr: string) => findOption(eqStr, (l) => l === 'Simplify Radical');

describe('Simplify numeric radicals (#66, Deliverable 1)', () => {
  describe('trySimplifyRadical (unit)', () => {
    const simp = (expr: string) => {
      const out = trySimplifyRadical(math.parse(expr));
      return out ? out.toString() : null;
    };

    test('extracts the largest perfect-square factor', () => {
      expect(simp('sqrt(8)')).toBe('2 * sqrt(2)');
      expect(simp('sqrt(12)')).toBe('2 * sqrt(3)');
      expect(simp('sqrt(18)')).toBe('3 * sqrt(2)');
      expect(simp('sqrt(72)')).toBe('6 * sqrt(2)');
      expect(simp('sqrt(200)')).toBe('10 * sqrt(2)');
    });

    test('handles nthRoot with an explicit degree', () => {
      expect(simp('nthRoot(16, 3)')).toBe('2 * nthRoot(2, 3)');
      expect(simp('nthRoot(54, 3)')).toBe('3 * nthRoot(2, 3)');
    });

    test('returns null when already in simplest form', () => {
      expect(simp('sqrt(2)')).toBeNull();
      expect(simp('sqrt(6)')).toBeNull();
      expect(simp('sqrt(7)')).toBeNull();
      expect(simp('nthRoot(2, 3)')).toBeNull();
    });

    test('returns null for a perfect power (left to constant folding)', () => {
      expect(simp('sqrt(4)')).toBeNull();
      expect(simp('sqrt(9)')).toBeNull();
      expect(simp('sqrt(16)')).toBeNull();
      expect(simp('nthRoot(8, 3)')).toBeNull();
    });

    test('returns null for non-integer / symbolic radicands', () => {
      expect(simp('sqrt(x)')).toBeNull();
      expect(simp('sqrt(2.5)')).toBeNull();
      expect(simp('sqrt(x^2)')).toBeNull();
    });
  });

  describe('offered as an inline "Simplify Radical" handle', () => {
    test('sqrt(8) offers the exact radical, not a decimal', () => {
      const { opt } = findRadical('x = sqrt(8)');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('x = 2 * sqrt(2)');
    });

    test('the generic "Simplify" handle is exact, not a decimal collapse', () => {
      // A decimal is only ever offered under the explicit, opt-in "Evaluate to
      // Decimal" label — the default simplification must stay exact (#66). Before
      // this change, folding sqrt(8) produced a generic "Simplify -> 2.83".
      const eq = parseEquation('x = sqrt(8)');
      const reductions = getReducibleOptions(eq);
      const decimalGenerics = Object.values(reductions)
        .flat()
        .filter((r) => (r.label === 'Simplify' || r.label === 'Simplify Radical'))
        .map((r) => equationToString(r.simplified))
        .filter((s) => /\d\.\d/.test(s));
      expect(decimalGenerics).toEqual([]);
    });

    test('already-simplest radical offers no radical handle', () => {
      const { opt } = findRadical('x = sqrt(2)');
      expect(opt).toBeUndefined();
    });

    test('does not offer "Express as Cube" on the radicand of sqrt(8)', () => {
      const { opt } = findOption('x = sqrt(8)', (l) => !!l && l.startsWith('Express as'));
      expect(opt).toBeUndefined();
    });
  });
});
