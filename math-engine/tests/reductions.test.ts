import { parseEquation, getReducibleOptions, equationToString } from '../src';

describe('Algebraic Reducible Options & Labeling Tests', () => {
  test('should correctly label decimal evaluations as "Evaluate to Decimal"', () => {
    const eq = parseEquation('x = 2.5 / 5');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    const decimalEval = reductions['rhs'].find(r => r.label === 'Evaluate to Decimal');
    expect(decimalEval).toBeDefined();
    expect(equationToString(decimalEval!.simplified)).toBe('x = 0.5');
  });

  test('should NOT label integer evaluations as "Evaluate to Decimal" but as "Simplify Fraction"', () => {
    const eq = parseEquation('x = 6 / 2');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    const decimalEval = reductions['rhs'].find(r => r.label === 'Evaluate to Decimal');
    expect(decimalEval).toBeUndefined();

    // Standard simplification of a division node should be labeled 'Simplify Fraction'
    const standardReduction = reductions['rhs'].find(r => r.label === 'Simplify Fraction' && r.type === 'reduce');
    expect(standardReduction).toBeDefined();
    expect(equationToString(standardReduction!.simplified)).toBe('x = 3');
  });

  test('should offer both constant folding and distribution options for constant fractions with appropriate labels', () => {
    const eq = parseEquation('x = (10 - 6) / 2');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    
    // Constant folding (simplify fraction to 2)
    const reduceOption = reductions['rhs'].find(r => r.label === 'Simplify Fraction' && r.type === 'reduce');
    expect(reduceOption).toBeDefined();
    expect(equationToString(reduceOption!.simplified)).toBe('x = 2');

    // Distribution (distribute division)
    const distributeOption = reductions['rhs'].find(r => r.label === 'Distribute' && r.type === 'distribute');
    expect(distributeOption).toBeDefined();
    expect(equationToString(distributeOption!.simplified)).toBe('x = (10 / 2) - (6 / 2)');
  });

  test('should label non-fraction simplifications as "Simplify"', () => {
    const eq = parseEquation('x = 5 + 3');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    const standardReduction = reductions['rhs'].find(r => r.label === 'Simplify' && r.type === 'reduce');
    expect(standardReduction).toBeDefined();
    expect(equationToString(standardReduction!.simplified)).toBe('x = 8');
  });

  test('should correctly label high-school identities like Pythagorean Identity', () => {
    const eq = parseEquation('x = sin(theta) ^ 2 + cos(theta) ^ 2');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    const identityOption = reductions['rhs'].find(r => r.label === 'Pythagorean Identity');
    expect(identityOption).toBeDefined();
    expect(equationToString(identityOption!.simplified)).toBe('x = 1');
  });

  test('should correctly label perfect powers as Express as Square and Express as Cube', () => {
    // 9 -> 3^2
    const eqSquare = parseEquation('x = 9');
    const reductionsSquare = getReducibleOptions(eqSquare);
    expect(reductionsSquare['rhs']).toBeDefined();
    const squareOption = reductionsSquare['rhs'].find(r => r.label === 'Express as Square');
    expect(squareOption).toBeDefined();
    expect(equationToString(squareOption!.simplified)).toBe('x = 3 ^ 2');

    // 8 -> 2^3
    const eqCube = parseEquation('x = 8');
    const reductionsCube = getReducibleOptions(eqCube);
    expect(reductionsCube['rhs']).toBeDefined();
    const cubeOption = reductionsCube['rhs'].find(r => r.label === 'Express as Cube');
    expect(cubeOption).toBeDefined();
    expect(equationToString(cubeOption!.simplified)).toBe('x = 2 ^ 3');
  });

  test('should correctly label power expansions as Expand Power', () => {
    const eq = parseEquation('x = y ^ 2');
    const reductions = getReducibleOptions(eq);

    expect(reductions['rhs']).toBeDefined();
    const expandOption = reductions['rhs'].find(r => r.label === 'Expand Power');
    expect(expandOption).toBeDefined();
    expect(equationToString(expandOption!.simplified)).toBe('x = y * y');
  });

  test('should correctly label quadratic solver moves', () => {
    const eq = parseEquation('x ^ 2 - 5 * x + 6 = 0');
    const reductions = getReducibleOptions(eq);

    // Offered on LHS since variable 'x' is on LHS
    expect(reductions['lhs']).toBeDefined();
    
    const posOption = reductions['lhs'].find(r => r.label === 'Apply Quadratic Formula (+)');
    expect(posOption).toBeDefined();
    expect(equationToString(posOption!.simplified)).toBe('x = (-(-5) + sqrt((-5) ^ 2 - 4 * 1 * 6)) / (2 * 1)');

    const negOption = reductions['lhs'].find(r => r.label === 'Apply Quadratic Formula (-)');
    expect(negOption).toBeDefined();
    expect(equationToString(negOption!.simplified)).toBe('x = (-(-5) - sqrt((-5) ^ 2 - 4 * 1 * 6)) / (2 * 1)');
  });
});
