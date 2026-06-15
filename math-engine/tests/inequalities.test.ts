import { parseEquation, equationToString, applyGlobalOp, getSimplificationForPath, autoSimplify } from '../src';
import { areEquationsEquivalent, generateValidMoves } from '../src/validator';

describe('Inequalities (#34)', () => {
  describe('parsing & formatting', () => {
    it('parses each relation operator and round-trips it', () => {
      const cases = ['2 * x + 4 < 10', 'x > 3', 'x <= 5', 'x >= -2', 'x = 5'];
      cases.forEach((eqStr) => {
        const eq = parseEquation(eqStr);
        expect(equationToString(eq)).toBe(eqStr);
      });
    });

    it('records the relation on the parsed equation', () => {
      expect(parseEquation('x < 5').relation).toBe('<');
      expect(parseEquation('x >= 5').relation).toBe('>=');
      expect(parseEquation('x = 5').relation).toBe('=');
    });

    it('rejects more than one relation operator', () => {
      expect(() => parseEquation('1 < x < 5')).toThrow();
      expect(() => parseEquation('x < y = 5')).toThrow();
    });
  });

  describe('applyGlobalOp sign flips', () => {
    it('flips the relation when multiplying/dividing by a negative constant', () => {
      expect(equationToString(applyGlobalOp(parseEquation('x < 5'), { type: 'mul', term: '-2' })))
        .toBe('x * -2 > 5 * -2');
      expect(equationToString(applyGlobalOp(parseEquation('x >= 4'), { type: 'div', term: '-2' })))
        .toBe('x / -2 <= 4 / -2');
    });

    it('does not flip for positive constants or addition/subtraction', () => {
      expect(applyGlobalOp(parseEquation('x < 5'), { type: 'mul', term: '2' }).relation).toBe('<');
      expect(applyGlobalOp(parseEquation('x < 5'), { type: 'sub', term: '3' }).relation).toBe('<');
      expect(applyGlobalOp(parseEquation('x < 5'), { type: 'add', term: '-3' }).relation).toBe('<');
    });

    it('never flips an equality', () => {
      expect(applyGlobalOp(parseEquation('x = 5'), { type: 'mul', term: '-2' }).relation).toBe('=');
    });
  });

  describe('areEquationsEquivalent', () => {
    it('accepts region-preserving inequality transforms', () => {
      expect(areEquationsEquivalent(parseEquation('2 * x + 4 < 10'), parseEquation('2 * x < 6'))).toBe(true);
      // Dividing by a negative requires the flipped direction to stay equivalent.
      expect(areEquationsEquivalent(parseEquation('-2 * x < 6'), parseEquation('x > -3'))).toBe(true);
    });

    it('rejects an unflipped negative division (wrong region)', () => {
      expect(areEquationsEquivalent(parseEquation('-2 * x < 6'), parseEquation('x < -3'))).toBe(false);
    });

    it('rejects strictness mismatches and equality/inequality mismatches', () => {
      expect(areEquationsEquivalent(parseEquation('x < 5'), parseEquation('x <= 5'))).toBe(false);
      expect(areEquationsEquivalent(parseEquation('x < 5'), parseEquation('x = 5'))).toBe(false);
    });
  });

  describe('generateValidMoves transposition', () => {
    it('transposes an additive term without flipping', () => {
      const eq = parseEquation('x + 2 < 5');
      const moves = generateValidMoves(eq, 'lhs/1');
      expect(moves['rhs']).toBeDefined();
      expect(equationToString(moves['rhs'])).toBe('x < 5 - 2');
    });
  });

  describe('degenerate / coincident-side inequalities', () => {
    // Substituting x = -3 into `-x * -1 > 3 * -1` produces `-(-3) * -1 > 3 * -1`,
    // whose sides both equal -3. The simplify handles must still fire (the gap is
    // 0 everywhere, which earlier made region-equivalence reject the fold).
    it('simplify handles collapse a coincident-side inequality, preserving direction', () => {
      const step1 = getSimplificationForPath(parseEquation('-(-3) * -1 > 3 * -1'), 'lhs');
      expect(step1).not.toBeNull();
      expect(step1!.relation).toBe('>');
      expect(equationToString(step1!)).toBe('-3 > 3 * -1');

      const step2 = getSimplificationForPath(step1!, 'rhs');
      expect(step2).not.toBeNull();
      expect(equationToString(step2!)).toBe('-3 > -3');

      // autoSimplify takes the constant identity all the way to `0 > 0` (the same
      // collapse the `=` form does), with the relation intact.
      expect(equationToString(autoSimplify(parseEquation('-(-3) * -1 > 3 * -1')))).toBe('0 > 0');
    });

    it('areEquationsEquivalent handles coincident-gap inequalities', () => {
      expect(areEquationsEquivalent(parseEquation('-3 > -3'), parseEquation('0 > 0'))).toBe(true);
      // Both empty solution sets (always false) — equivalent despite opposite direction.
      expect(areEquationsEquivalent(parseEquation('x < x'), parseEquation('x > x'))).toBe(true);
      // Always-false vs always-true must stay distinct.
      expect(areEquationsEquivalent(parseEquation('x < x'), parseEquation('x < x + 1'))).toBe(false);
    });
  });
});
