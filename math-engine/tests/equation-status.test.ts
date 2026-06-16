import { parseEquation, ensureNodeIds, getEquationStatus } from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

describe('getEquationStatus', () => {
  describe('identities (always true)', () => {
    it('handles simple equalities', () => {
      expect(getEquationStatus(eq('0 = 0'))).toBe('identity');
      expect(getEquationStatus(eq('3 = 3'))).toBe('identity');
      expect(getEquationStatus(eq('sqrt(4) = 2'))).toBe('identity');
      expect(getEquationStatus(eq('-(-3) = 3'))).toBe('identity');
    });

    it('handles inequalities', () => {
      expect(getEquationStatus(eq('2 < 5'))).toBe('identity');
      expect(getEquationStatus(eq('-3 > -5'))).toBe('identity');
      expect(getEquationStatus(eq('2 <= 2'))).toBe('identity');
      expect(getEquationStatus(eq('10 >= 5'))).toBe('identity');
    });

    it('handles equations with known constants (pi, e)', () => {
      expect(getEquationStatus(eq('pi < 4'))).toBe('identity');
      expect(getEquationStatus(eq('e > 2'))).toBe('identity');
    });
  });

  describe('contradictions (always false)', () => {
    it('handles simple equalities', () => {
      expect(getEquationStatus(eq('3 = -3'))).toBe('contradiction');
      expect(getEquationStatus(eq('0 = 1'))).toBe('contradiction');
      expect(getEquationStatus(eq('sqrt(2) = 1.41'))).toBe('contradiction'); // exact vs approx
    });

    it('handles inequalities', () => {
      expect(getEquationStatus(eq('5 < 2'))).toBe('contradiction');
      expect(getEquationStatus(eq('2 > 2'))).toBe('contradiction');
      expect(getEquationStatus(eq('2 <= -1'))).toBe('contradiction');
      expect(getEquationStatus(eq('-2 >= 0'))).toBe('contradiction');
    });

    it('handles equations with known constants (pi, e)', () => {
      expect(getEquationStatus(eq('e = 3'))).toBe('contradiction');
      expect(getEquationStatus(eq('pi < 3'))).toBe('contradiction');
    });
  });

  describe('conditionals (contains variables)', () => {
    it('detects variables on either side', () => {
      expect(getEquationStatus(eq('x = 3'))).toBe('conditional');
      expect(getEquationStatus(eq('3 = y'))).toBe('conditional');
      expect(getEquationStatus(eq('x + 2 = 5'))).toBe('conditional');
      expect(getEquationStatus(eq('2 * x < 10'))).toBe('conditional');
    });

    it('distinguishes variables from constants', () => {
      expect(getEquationStatus(eq('pi = x'))).toBe('conditional');
      expect(getEquationStatus(eq('x < e'))).toBe('conditional');
    });
  });
});
