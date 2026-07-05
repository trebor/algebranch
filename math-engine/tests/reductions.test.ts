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

    // 64 -> 8^2, 4^3, and 2^6
    const eqBoth = parseEquation('x = 64');
    const reductionsBoth = getReducibleOptions(eqBoth);
    expect(reductionsBoth['rhs']).toBeDefined();
    const squareOptionBoth = reductionsBoth['rhs'].find(r => r.label === 'Express as Square');
    const cubeOptionBoth = reductionsBoth['rhs'].find(r => r.label === 'Express as Cube');
    const sixthOptionBoth = reductionsBoth['rhs'].find(r => r.label === 'Express as 6th Power');
    expect(squareOptionBoth).toBeDefined();
    expect(cubeOptionBoth).toBeDefined();
    expect(sixthOptionBoth).toBeDefined();
    expect(equationToString(squareOptionBoth!.simplified)).toBe('x = 8 ^ 2');
    expect(equationToString(cubeOptionBoth!.simplified)).toBe('x = 4 ^ 3');
    expect(equationToString(sixthOptionBoth!.simplified)).toBe('x = 2 ^ 6');
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

  test('should NOT offer quadratic formula when b=0 (solvable by isolation + square root)', () => {
    const eq = parseEquation('x ^ 2 + y ^ 2 = r ^ 2');
    const reductions = getReducibleOptions(eq);

    // Collect all quadratic formula options across all paths
    const allQuadOpts = Object.values(reductions).flat().filter(
      r => r.label && r.label.includes('Quadratic')
    );
    expect(allQuadOpts.length).toBe(0);
  });

  // #59: a single Simplify must not collapse several elementary moves at once.
  describe('decomposed simplify — no opaque multi-op collapse (#59)', () => {
    const lhsResults = (s: string) =>
      Object.values(getReducibleOptions(parseEquation(s)))
        .flat()
        .filter(r => r.type === 'reduce')
        .map(r => r.simplified.lhs.toString());

    test('does NOT offer the all-at-once collapse m * x * 1 / x -> m', () => {
      const results = lhsResults('m * x * 1 / x + b / x = 4');
      // The opaque one-click result (… -> m + b/x) is gone …
      expect(results).not.toContain('m + b / x');
      // … replaced by the inspectable sub-steps: drop ×1, then cancel x/x.
      expect(results).toContain('m * x / x + b / x'); // dropped the ×1
      expect(results).toContain('m * 1 + b / x');     // cancelled x/x
    });

    test('does NOT offer the whole-side recombination (strange placement)', () => {
      const results = lhsResults('m * x * 1 / x + b / x = 4');
      expect(results).not.toContain('(b + x * m) / x');
    });

    test('still offers a lone cancellation as a single step (not over-suppressed)', () => {
      const results = lhsResults('m * x / x = c');
      expect(results).toContain('m'); // m * x / x -> m in one step is fine
    });

    test('still offers combining like terms as a single step', () => {
      const results = lhsResults('3 * x - x = 5');
      expect(results).toContain('2 * x');
    });

    // A simplification that collapses the parent (m * 1 -> m) leaves the tagged
    // path unresolvable in the result; that must not silently drop the option.
    test('offers an identity drop that collapses its parent (m * 1 -> m)', () => {
      expect(lhsResults('m * 1 = 4')).toContain('m');
      expect(lhsResults('m * 1 + b / x = 4')).toContain('m + b / x');
      expect(lhsResults('x + 0 = 5')).toContain('x');
    });

    test('offers each identity drop independently (a * 1 + b * 1)', () => {
      const results = lhsResults('a * 1 + b * 1 = 4');
      expect(results).toContain('a + b * 1');
      expect(results).toContain('a * 1 + b');
    });
  });

  // The UI suppresses "Evaluate to Decimal" via filteredReduciblePathsAtom (a jotai
  // atom that can't be imported here). This test pins the engine-side contract that
  // filter depends on — the label is emitted — and mirrors the filter to document it.
  test('engine emits the "Evaluate to Decimal" label the UI suppression filters on', () => {
    const eq = parseEquation('x = 2.5 / 5');
    const reductions = getReducibleOptions(eq);

    const filtered: Record<string, typeof reductions[string]> = {};
    Object.keys(reductions).forEach((path) => {
      const filteredActions = reductions[path].filter(
        (action) => action.label !== 'Evaluate to Decimal'
      );
      if (filteredActions.length > 0) {
        filtered[path] = filteredActions;
      }
    });

    expect(reductions['rhs'].find(r => r.label === 'Evaluate to Decimal')).toBeDefined();
    expect(filtered['rhs']?.find(r => r.label === 'Evaluate to Decimal')).toBeUndefined();
  });

  test('should offer simplification of perfect nthRoot to constant', () => {
    const eq = parseEquation('nthRoot(8, 3) = x');
    const reductions = getReducibleOptions(eq);
    const options = reductions['lhs'] || [];
    const simplifyOption = options.find((o) => o.label === 'Simplify');
    expect(simplifyOption).toBeDefined();
    expect(simplifyOption?.simplified.lhs.toString()).toBe('2');
  });
});

