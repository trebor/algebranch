import {
  parseEquation,
  ensureNodeIds,
  getUndefinedDivisionPaths,
  computeMathSync,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

describe('#413 — flag division-by-zero subtrees as undefined', () => {
  describe('getUndefinedDivisionPaths', () => {
    it('flags a variable over a literal zero (x / 0)', () => {
      expect(getUndefinedDivisionPaths(eq('y = x/0'))).toEqual(['rhs']);
    });

    it('flags a constant over zero (3 / 0)', () => {
      expect(getUndefinedDivisionPaths(eq('y = 3/0'))).toEqual(['rhs']);
    });

    it('flags a sum over zero ((a + b) / 0)', () => {
      expect(getUndefinedDivisionPaths(eq('y = (a + b)/0'))).toEqual(['rhs']);
    });

    it('flags a denominator that folds to zero (x / (2 - 2))', () => {
      expect(getUndefinedDivisionPaths(eq('y = x/(2 - 2)'))).toEqual(['rhs']);
    });

    it('does NOT flag an ordinary division with a nonzero denominator (x / 5)', () => {
      expect(getUndefinedDivisionPaths(eq('y = x/5'))).toEqual([]);
    });

    it('does NOT flag a symbolic denominator that is not provably zero (x / y)', () => {
      expect(getUndefinedDivisionPaths(eq('y = x/y'))).toEqual([]);
    });

    it('flags only the offending division, not a valid sibling subtree', () => {
      // The x/0 term is undefined; the x/5 term beside it is fine.
      const paths = getUndefinedDivisionPaths(eq('y = x/0 + x/5'));
      expect(paths).toEqual(['rhs/0']);
    });
  });

  describe('computeMathSync surfaces the diagnostic', () => {
    it('reports the undefined path in the sync payload', () => {
      const result = computeMathSync(eq('y = x/0'), null);
      expect(result.undefinedPaths).toEqual([
        { path: 'rhs', reason: 'division-by-zero' },
      ]);
    });

    it('reports no undefined paths for an ordinary equation', () => {
      const result = computeMathSync(eq('y = x/5'), null);
      expect(result.undefinedPaths).toEqual([]);
    });
  });
});
