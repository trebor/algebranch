import { parseEquation, getReducibleOptions, equationToString } from '../src';
import { tryCompleteTheSquare } from '../src/simplify';
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

const findCTS = (eqStr: string) => findOption(eqStr, (l) => l === 'Complete the Square');

describe('Complete the Square (#62)', () => {
  describe('tryCompleteTheSquare (unit)', () => {
    const cts = (expr: string) => {
      const out = tryCompleteTheSquare(math.parse(expr));
      return out ? out.toString() : null;
    };

    test('rewrites a monic quadratic to vertex form', () => {
      expect(cts('x^2 + 6*x + 5')).toBe('(x + 3) ^ 2 - 4');
    });

    test('handles a negative linear coefficient', () => {
      expect(cts('x^2 - 6*x + 5')).toBe('(x - 3) ^ 2 - 4');
    });

    test('factors out a leading coefficient', () => {
      expect(cts('2*x^2 + 8*x + 5')).toBe('2 * (x + 2) ^ 2 - 3');
    });

    test('keeps non-integer results as exact fractions, never decimals', () => {
      expect(cts('x^2 + 3*x + 1')).toBe('(x + 3 / 2) ^ 2 - 5 / 4');
    });

    test('returns null when there is no quadratic term (linear)', () => {
      expect(cts('2*x + 5')).toBeNull();
    });

    test('returns null when already complete (no linear term, b = 0)', () => {
      expect(cts('x^2 + 4')).toBeNull();
      expect(cts('x^2')).toBeNull();
    });

    test('returns null for unsupported / non-quadratic forms', () => {
      expect(cts('x^3 + x^2 + 1')).toBeNull(); // cubic
      expect(cts('x^2 + 6*x + y')).toBeNull(); // symbolic constant term (deferred)
      expect(cts('5')).toBeNull();
    });
  });

  describe('offered as an inline "Complete the Square" handle', () => {
    test('on a quadratic equation set to zero', () => {
      const { opt } = findCTS('x^2 + 6*x + 5 = 0');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('(x + 3) ^ 2 - 4 = 0');
    });

    test('on the RHS of a y = ... graphing form (vertex form)', () => {
      const { opt } = findCTS('y = x^2 + 6*x + 5');
      expect(opt).toBeDefined();
      expect(equationToString(opt!.simplified)).toBe('y = (x + 3) ^ 2 - 4');
    });

    test('is NOT offered for a linear equation', () => {
      const { opt } = findCTS('2*x + 5 = 0');
      expect(opt).toBeUndefined();
    });
  });
});
