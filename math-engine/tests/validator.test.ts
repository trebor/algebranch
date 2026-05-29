import { parseEquation, equationToString } from '../src/index';
import { areEquationsEquivalent, generateValidMoves } from '../src/validator';
import { autoSimplify, getSimplificationForPath } from '../src/simplify';

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

  test('areEquationsEquivalent rejects division by zero and domain errors', () => {
    const eq1 = parseEquation('0 = 4 - x^2');
    const eqInvalid = parseEquation('x / 0 = 4 - 2');
    expect(areEquationsEquivalent(eq1, eqInvalid)).toBe(false);
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

  test('generateValidMoves excludes parent and parenthesis-wrapped parent paths from destinations', () => {
    const eq = parseEquation('x + 2 = 5');
    // Path for 'x' in 'x + 2 = 5' is 'lhs/0'. Immediate parent is 'lhs'.
    const moves = generateValidMoves(eq, 'lhs/0');
    expect(moves['lhs']).toBeUndefined(); // Parent path 'lhs' is excluded
  });

  test('generateValidMoves suggests division for multiplicative terms', () => {
    const eq = parseEquation('x * y = 7 - 3');
    // Path for 'y' in 'x * y = 7 - 3' is 'lhs/1'
    const moves = generateValidMoves(eq, 'lhs/1');
    
    // It should suggest moving 'y' to RHS as division: 'x = (7 - 3) / y'
    expect(moves['rhs']).toBeDefined();
    expect(equationToString(moves['rhs'])).toBe('x = (7 - 3) / y');
  });

  test('generateValidMoves rejects overwriting non-neutral constants', () => {
    const eq = parseEquation('3 * x + 5 = x + 13');
    // Path for 'x' in '3 * x' is 'lhs/0/1'.
    const moves = generateValidMoves(eq, 'lhs/0/1');
    
    // It should NOT allow overwriting '13' (path 'rhs/1') to produce '3 + 5 = x + x'
    // even though both equations happen to share x = 4 as a unique solution root.
    expect(moves['rhs/1']).toBeUndefined();
  });

  test('generateValidMoves rejects deep cross-equals drops', () => {
    const eq = parseEquation('x + 4 = (y - 1) * 2');
    // Path for '4' is 'lhs/1'.
    const moves = generateValidMoves(eq, 'lhs/1');
    
    // It should NOT allow dropping '4' deep inside the RHS tree (e.g. at 'rhs/0/0/1' which is '1' in 'y - 1')
    // to produce 'x = (y - (4 - 1)) * 2', even though it is mathematically equivalent.
    // The only allowed drop target on the RHS must be the root 'rhs'.
    expect(moves['rhs/0/0/1']).toBeUndefined();
    expect(moves['rhs']).toBeDefined();
    expect(equationToString(moves['rhs'])).toBe('x = (y - 1) * 2 - 4');
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

  test('getSimplificationForPath identifies simplification opportunities correctly', () => {
    // 1. Redundant parenthesis
    const eq1 = parseEquation('(x) + 2 = 5');
    const simplified1 = getSimplificationForPath(eq1, 'lhs/0');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('x + 2 = 5');

    // 2. Identity addition (+ 0)
    const eq2 = parseEquation('x + 0 = 5');
    const simplified2 = getSimplificationForPath(eq2, 'lhs/1');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('x = 5');

    // 3. Double removal (+ 2 - 2)
    const eq3 = parseEquation('x + 2 - 2 = 5');
    const simplified3_1 = getSimplificationForPath(eq3, 'lhs/0/1');
    const simplified3_2 = getSimplificationForPath(eq3, 'lhs/1');
    expect(simplified3_1).not.toBeNull();
    expect(equationToString(simplified3_1!)).toBe('x = 5');
    expect(simplified3_2).not.toBeNull();
    expect(equationToString(simplified3_2!)).toBe('x = 5');

    // 4. Non-simplifiable node
    const eq4 = parseEquation('3 * x + 5 = 12');
    const simplified4 = getSimplificationForPath(eq4, 'lhs/0/0'); // '3'
    expect(simplified4).toBeNull();
  });

  test('getSimplificationForPath performs constant folding correctly', () => {
    // 1. Basic addition of constants
    const eq1 = parseEquation('x = 2 + 3');
    const simplified1 = getSimplificationForPath(eq1, 'rhs');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('x = 5');

    // 2. Complex nested constants
    const eq2 = parseEquation('x = (12 - 4) * 2');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('x = 16');

    // 3. Constant function (sqrt(9))
    const eq3 = parseEquation('x = sqrt(9)');
    const simplified3 = getSimplificationForPath(eq3, 'rhs');
    expect(simplified3).not.toBeNull();
    expect(equationToString(simplified3!)).toBe('x = 3');

    // 4. Does not fold expressions containing variables
    const eq4 = parseEquation('x = 2 * y + 3');
    const simplified4 = getSimplificationForPath(eq4, 'rhs');
    expect(simplified4).toBeNull();
  });

  test('getSimplificationForPath rejects no-op simplifications for standalone zero nodes', () => {
    const eq = parseEquation('0 = x + 13');
    // Path for '0' is 'lhs'
    const simplified = getSimplificationForPath(eq, 'lhs');
    expect(simplified).toBeNull();
  });

  test('areEquationsEquivalent rejects non-equivalent non-linear equations sharing a root', () => {
    // x ^ 2 - 4 = 0 has roots {2, -2}
    // 2 - 4 + x = 0 (which is x - 2 = 0) has a single root {2}
    // They are NOT equivalent because their solution sets differ
    const eq1 = parseEquation('x ^ 2 - 4 = 0');
    const eq2 = parseEquation('2 - 4 + x = 0');
    expect(areEquationsEquivalent(eq1, eq2)).toBe(false);
  });

  test('generateValidMoves blocks dragging exponents or bases out of power nodes', () => {
    const eq = parseEquation('x ^ 2 - 4 = 0');
    // Path for '2' in 'x ^ 2' is 'lhs/0/1'
    const movesExponent = generateValidMoves(eq, 'lhs/0/1');
    expect(Object.keys(movesExponent).length).toBe(0);

    // Path for 'x' in 'x ^ 2' is 'lhs/0/0'
    const movesBase = generateValidMoves(eq, 'lhs/0/0');
    expect(Object.keys(movesBase).length).toBe(0);
  });
});

