import { parseEquation, equationToString } from '../src/index';
import { areEquationsEquivalent, generateValidMoves } from '../src/validator';
import { autoSimplify } from '../src/simplify';

describe('Math Engine Validator & Simplifier', () => {
  test('parseEquation and equationToString work correctly', () => {
    const eqStr = 'x + 2 = 5';
    const eq = parseEquation(eqStr);
    expect(equationToString(eq)).toBe('x + 2 = 5');
  });

  test('areEquationsEquivalent verifies algebraic identities', () => {
    const eq1 = parseEquation('x + 2 = 5');

    // Mathematically equivalent equations
    const eqEquivalent1 = parseEquation('x = 5 - 2');
    const eqEquivalent2 = parseEquation('x = 3');

    // Mathematically non-equivalent equations
    const eqNonEquivalent1 = parseEquation('x = 5 + 2');
    const eqNonEquivalent2 = parseEquation('x = 7');

    expect(areEquationsEquivalent(eq1, eqEquivalent1)).toBe(true);
    expect(areEquationsEquivalent(eq1, eqEquivalent2)).toBe(true);
    expect(areEquationsEquivalent(eq1, eqNonEquivalent1)).toBe(false);
    expect(areEquationsEquivalent(eq1, eqNonEquivalent2)).toBe(false);
  });

  test('generateValidMoves suggests correct algebraic transfers', () => {
    const eq = parseEquation('x + 2 = 5');

    // Path for '2' in 'x + 2 = 5' is 'lhs/1' (since addition is left-associative, let's verify path)
    // Wait, let's check what all paths are:
    // 'lhs' is 'x + 2', its children are 'lhs/0' (x) and 'lhs/1' (2).
    const moves = generateValidMoves(eq, 'lhs/1');

    // It should suggest moving '2' to RHS as '- 2' wrapping the RHS: 'x = 5 - 2'
    // Let's verify that the target path 'rhs' has a valid move.
    expect(moves['rhs']).toBeDefined();
    expect(equationToString(moves['rhs'])).toBe('x = 5 - 2');
  });

  test('autoSimplify eliminates redundant terms', () => {
    // Additive redundancy: x + 2 - 2 = 5  =>  x = 5
    const eq1 = parseEquation('x + 2 - 2 = 5');
    const simplified1 = autoSimplify(eq1);
    expect(equationToString(simplified1)).toBe('x = 5');

    // Multiplicative redundancy: x * y / y = 5  =>  x = 5
    const eq2 = parseEquation('(x * y) / y = 5');
    const simplified2 = autoSimplify(eq2);
    expect(equationToString(simplified2)).toBe('x = 5');

    // Identity addition: x + 0 = 5  =>  x = 5
    const eq3 = parseEquation('x + 0 = 5');
    const simplified3 = autoSimplify(eq3);
    expect(equationToString(simplified3)).toBe('x = 5');
  });
});
