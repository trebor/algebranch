import * as math from 'mathjs';
import { parseEquation, equationToString, Equation, tryExpandPowerTerm, tryCombinePowerTerms } from '../src/index';
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
    // 1. Redundant parenthesis (manually constructed to bypass auto-stripping during parsing)
    const eq1: Equation = {
      lhs: new math.OperatorNode('+', 'add', [
        new math.ParenthesisNode(new math.SymbolNode('x')),
        new math.ConstantNode(2)
      ]),
      rhs: new math.ConstantNode(5)
    };
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
    const eq = parseEquation('x ^ 3 - 4 = 0');
    // Path for '3' in 'x ^ 3' is 'lhs/0/1'
    const movesExponent = generateValidMoves(eq, 'lhs/0/1');
    expect(Object.keys(movesExponent).length).toBe(0);

    // Path for 'x' in 'x ^ 3' is 'lhs/0/0'
    const movesBase = generateValidMoves(eq, 'lhs/0/0');
    expect(Object.keys(movesBase).length).toBe(0);
  });

  test('getSimplificationForPath simplifies roots of matching powers correctly', () => {
    // 1. sqrt(x ^ 2) -> x
    const eq1 = parseEquation('y = sqrt(x ^ 2)');
    const simplified1 = getSimplificationForPath(eq1, 'rhs');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('y = x');

    // 2. nthRoot(x ^ 3, 3) -> x
    const eq2 = parseEquation('y = nthRoot(x ^ 3, 3)');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('y = x');

    // 3. nthRoot(x ^ 2) -> x
    const eq3 = parseEquation('y = nthRoot(x ^ 2)');
    const simplified3 = getSimplificationForPath(eq3, 'rhs');
    expect(simplified3).not.toBeNull();
    expect(equationToString(simplified3!)).toBe('y = x');

    // 4. nthRoot(x ^ n, n) -> x
    const eq4 = parseEquation('y = nthRoot(x ^ n, n)');
    const simplified4 = getSimplificationForPath(eq4, 'rhs');
    expect(simplified4).not.toBeNull();
    expect(equationToString(simplified4!)).toBe('y = x');

    // 5. Does not simplify non-matching degree
    const eq5 = parseEquation('y = nthRoot(x ^ 2, 3)');
    const simplified5 = getSimplificationForPath(eq5, 'rhs');
    expect(simplified5).toBeNull();
  });

  test('getSimplificationForPath simplifies powers of matching roots correctly', () => {
    // 1. sqrt(5 + x) ^ 2 -> 5 + x
    const eq1 = parseEquation('y = sqrt(5 + x) ^ 2');
    const simplified1 = getSimplificationForPath(eq1, 'rhs');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('y = 5 + x');

    // 2. sqrt((b - 5) * (b - 5)) ^ 2 -> (b - 5) * (b - 5)
    const eq2 = parseEquation('y = sqrt((b - 5) * (b - 5)) ^ 2');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('y = (b - 5) * (b - 5)');

    // 3. nthRoot(x, 3) ^ 3 -> x
    const eq3 = parseEquation('y = nthRoot(x, 3) ^ 3');
    const simplified3 = getSimplificationForPath(eq3, 'rhs');
    expect(simplified3).not.toBeNull();
    expect(equationToString(simplified3!)).toBe('y = x');

    // 4. nthRoot(x, n) ^ n -> x
    const eq4 = parseEquation('y = nthRoot(x, n) ^ n');
    const simplified4 = getSimplificationForPath(eq4, 'rhs');
    expect(simplified4).not.toBeNull();
    expect(equationToString(simplified4!)).toBe('y = x');

    // 5. Does not simplify non-matching degree
    const eq5 = parseEquation('y = nthRoot(x, 2) ^ 3');
    const simplified5 = getSimplificationForPath(eq5, 'rhs');
    expect(simplified5).toBeNull();
  });

  test('autoSimplify recursively simplifies roots of powers and powers of roots', () => {
    const eq = parseEquation('y = sqrt((x + 2) ^ 2) - 2');
    const simplified = autoSimplify(eq);
    expect(equationToString(simplified)).toBe('y = x');

    const eq2 = parseEquation('y = sqrt(x + 2) ^ 2 - 2');
    const simplified2 = autoSimplify(eq2);
    expect(equationToString(simplified2)).toBe('y = x');
  });

  test('getSimplificationForPath ignores non-simplifying commutative rearrangements', () => {
    // 1. y * 2 should NOT be simplified to 2 * y since it's just a commutative swap
    const eq1 = parseEquation('x + 4 = y * 2');
    const simplified1 = getSimplificationForPath(eq1, 'rhs');
    expect(simplified1).toBeNull();

    // 2. But actual algebraic reductions like 3 * x - x should still simplify to 2 * x
    const eq2 = parseEquation('y = 3 * x - x');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('y = 2 * x');
  });

  test('getSimplificationForPath identifies distribution opportunities correctly', () => {
    // 1. a * (b + c) -> a * b + a * c
    const eq1 = parseEquation('y = 2 * (x + 3)');
    const simplified1 = getSimplificationForPath(eq1, 'rhs');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('y = 2 * x + 2 * 3');

    // 2. (b - c) * a -> b * a - c * a
    const eq2 = parseEquation('y = (x - 4) * 3');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('y = x * 3 - 4 * 3');

    // 3. (b + c) / a -> b / a + c / a
    const eq3 = parseEquation('y = (x + 6) / 2');
    const simplified3 = getSimplificationForPath(eq3, 'rhs');
    expect(simplified3).not.toBeNull();
    expect(equationToString(simplified3!)).toBe('y = x / 2 + 6 / 2');
  });

  test('autoSimplify recursively simplifies and distributes terms', () => {
    // autoSimplify will distribute 2 * (x + 3) to 2 * x + 2 * 3, then constant fold 2 * 3 to 6!
    const eq = parseEquation('y = 2 * (x + 3)');
    const simplified = autoSimplify(eq);
    expect(equationToString(simplified)).toBe('y = 2 * x + 6');
  });

  test('getSimplificationForPath ignores no-op parenthesis reductions due to precedence', () => {
    // (x - 3) * (x + 3) = y
    // 'lhs/0' is the ParenthesisNode of (x - 3)
    // 'lhs/1' is the ParenthesisNode of (x + 3)
    const eq = parseEquation('(x - 3) * (x + 3) = y');
    expect(getSimplificationForPath(eq, 'lhs/0')).toBeNull();
    expect(getSimplificationForPath(eq, 'lhs/1')).toBeNull();
  });

  test('getSimplificationForPath constrains double removals to compatible inverse chains', () => {
    // 1. Direct inverse cancellation of terms (compatible: same additive operator chain)
    const eqCompatible = parseEquation('x + 2 - 2 = 5');
    // First '2' is at 'lhs/0/1', second '2' is at 'lhs/1'
    const simplifiedCompatible = getSimplificationForPath(eqCompatible, 'lhs/1');
    expect(simplifiedCompatible).not.toBeNull();
    expect(equationToString(simplifiedCompatible!)).toBe('x = 5');

    // 2. Coincidental cancellation of factors nested under mixed operator boundaries (incompatible: mixed additive/multiplicative)
    const eqIncompatible = parseEquation('x * x - 3 * x + x * 3 - 9 = y');
    // First '3' is at 'lhs/0/0/1/0' (nested under '*' and '-')
    const simplifiedIncompatible = getSimplificationForPath(eqIncompatible, 'lhs/0/0/1/0');
    expect(simplifiedIncompatible).toBeNull();
  });

  test('tryCombinePowerTerms and tryExpandPowerTerm work for arbitrary exponents', () => {
    // 1. Combining powers directly
    const xNode = new math.SymbolNode('x');
    const xSqNode = new math.OperatorNode('^', 'pow', [xNode, new math.ConstantNode(2)]);
    
    // x * x -> x^2
    const node1 = new math.OperatorNode('*', 'multiply', [xNode, xNode]);
    const res1 = tryCombinePowerTerms(node1);
    expect(res1).not.toBeNull();
    expect(res1!.toString()).toBe('x ^ 2');

    // x^2 * x -> x^3
    const node2 = new math.OperatorNode('*', 'multiply', [xSqNode, xNode]);
    const res2 = tryCombinePowerTerms(node2);
    expect(res2).not.toBeNull();
    expect(res2!.toString()).toBe('x ^ 3');

    // 2. Combining powers via getSimplificationForPath
    const eq1 = parseEquation('x * x = y + 9');
    const simplified1 = getSimplificationForPath(eq1, 'lhs');
    expect(simplified1).not.toBeNull();
    expect(equationToString(simplified1!)).toBe('x ^ 2 = y + 9');

    const eq2 = parseEquation('x^2 * x = y + 9');
    const simplified2 = getSimplificationForPath(eq2, 'lhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('x ^ 3 = y + 9');

    // 3. Expanding powers directly
    // x^3 -> x * x * x
    const xCubeNode = new math.OperatorNode('^', 'pow', [xNode, new math.ConstantNode(3)]);
    const resExpand = tryExpandPowerTerm(xCubeNode);
    expect(resExpand).not.toBeNull();
    expect(resExpand!.toString()).toBe('x * x * x'); // Left-associative mathjs representation without redundant parenthesis
  });

  test('generateValidMoves suggests quadratic formula solver moves for quadratic variable selection', () => {
    const eq1 = parseEquation('a * x^2 + b * x + c = 0');
    
    // Find path for 'x' dynamically
    const findPathForSymbol = (node: math.MathNode, targetName: string, currentPath: string): string | null => {
      if (node.type === 'SymbolNode' && (node as math.SymbolNode).name === targetName) {
        return currentPath;
      }
      const children = 'args' in node ? (node as any).args : ('content' in node ? [(node as any).content] : []);
      for (let i = 0; i < children.length; i++) {
        const path = findPathForSymbol(children[i], targetName, currentPath ? `${currentPath}/${i}` : (i === 0 ? 'lhs' : 'rhs'));
        if (path) return path;
      }
      return null;
    };

    const xPath = findPathForSymbol(eq1.lhs, 'x', 'lhs');
    expect(xPath).not.toBeNull();

    const moves = generateValidMoves(eq1, xPath!);
    expect(moves['rhs']).toBeDefined();

    const resultEq = equationToString(moves['rhs']);
    expect(resultEq).toBe('x = (-b + sqrt(b ^ 2 - 4 * a * c)) / (2 * a)');
  });

  test('should validate complex discriminant transpositions and variable-denominator moves', () => {
    // 1. Check complex discriminant transposition equivalence
    const eq1 = parseEquation('x = (-7 + sqrt(-383)) / 24');
    const eq2 = parseEquation('x * 24 = -7 + sqrt(-383)');
    expect(areEquationsEquivalent(eq1, eq2)).toBe(true);

    // 2. Check variable-to-denominator transposition on complex equations
    const eq3 = parseEquation('24 * x = sqrt(-383) - 7');
    const eq4 = parseEquation('24 = (sqrt(-383) - 7) / x');
    expect(areEquationsEquivalent(eq3, eq4)).toBe(true);

    // 3. Ensure real root restriction handles standard log rules correctly
    const eqLog1 = parseEquation('log(x^3) = 10');
    const eqLog2 = parseEquation('3 * log(x) = 10');
    expect(areEquationsEquivalent(eqLog1, eqLog2)).toBe(true);
  });
});


