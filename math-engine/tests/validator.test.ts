import * as math from 'mathjs';
import { parseEquation, equationToString, Equation, tryExpandPowerTerm, tryCombinePowerTerms } from '../src/index';
import { areEquationsEquivalent, generateValidMoves, hasValidMove } from '../src/validator';
import { getAllPaths } from '../src/tree';
import { autoSimplify, getSimplificationForPath } from '../src/simplify';

describe('Math Engine Validator & Simplifier', () => {
  test('parseEquation and equationToString work correctly', () => {
    const eqStr = 'x + 2 = 5';
    const eq = parseEquation(eqStr);
    expect(equationToString(eq)).toBe('x + 2 = 5');
  });

  test('parseEquation rejects reserved keywords as variable names', () => {
    expect(() => parseEquation('x = undefined')).toThrow();
    expect(() => parseEquation('undefined = y')).toThrow();
    expect(() => parseEquation('x = null')).toThrow();
    expect(() => parseEquation('x = NaN')).toThrow();
    expect(() => parseEquation('x = infinity')).toThrow();
    expect(() => parseEquation('x = true')).toThrow();
  });

  test('parseEquation rejects empty sides', () => {
    expect(() => parseEquation('x =')).toThrow();
    expect(() => parseEquation('= 5')).toThrow();
    expect(() => parseEquation('=')).toThrow();
  });

  test('parseEquation rejects unsupported operations and gray area features', () => {
    // Logical operations
    expect(() => parseEquation('x and y = z')).toThrow();
    expect(() => parseEquation('x or y = z')).toThrow();
    expect(() => parseEquation('not x = y')).toThrow();
    
    // Bitwise operations
    expect(() => parseEquation('x & y = z')).toThrow();
    expect(() => parseEquation('x | y = z')).toThrow();
    expect(() => parseEquation('~x = y')).toThrow();
    
    // Conditional / Ternary
    expect(() => parseEquation('x ? y : z = 5')).toThrow();
    
    // Matrix / Array / Ranges
    expect(() => parseEquation('[1, 2] = x')).toThrow();
    expect(() => parseEquation('x = A[1]')).toThrow();
    expect(() => parseEquation('x = 1:5')).toThrow();
    
    // Multiple relation operators are rejected (single inequalities are allowed — see #34)
    expect(() => parseEquation('x < y = 5')).toThrow();
    expect(() => parseEquation('x = y < 5')).toThrow();

    // Function Assignment
    expect(() => parseEquation('f(x) = x^2')).toThrow();
    
    // Unit conversion
    expect(() => parseEquation('5 cm to m = x')).toThrow();
    
    // Unsupported functions
    expect(() => parseEquation('x = random(1)')).toThrow();
    expect(() => parseEquation('x = log10(y)')).toThrow();
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

  test('areEquationsEquivalent handles identities with domain restrictions correctly', () => {
    const eq1 = parseEquation('(x - 1) / (x - 1) + 2 + 3 = 6');
    const eq2 = parseEquation('6 = 6');
    expect(areEquationsEquivalent(eq1, eq2)).toBe(true);
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

  test('generateValidMoves rejects algebraically invalid transformations that happen to share root solutions', () => {
    // 2 * (x + 3) = 10 -> LHS is 2 * (x + 3), which has paths:
    // lhs/0 = 2
    // lhs/1 = (x + 3)
    // lhs/1/0 = x + 3
    // lhs/1/0/1 = 3
    const eq = parseEquation('2 * (x + 3) = 10');
    
    // Dragging '3' (lhs/1/0/1) to drop onto '2' (lhs/0)
    const moves = generateValidMoves(eq, 'lhs/1/0/1');
    
    // This should NOT allow transforming the equation to (2 + 3) * x = 10,
    // even though both equations share x = 2 as a unique solution.
    expect(moves['lhs/0']).toBeUndefined();
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

  test('#301 — dragging the 1 in 1/x onto the left side is rejected (was: "(x + 1) / 1")', () => {
    // Plain-language repro, runnable by hand in the app:
    //   Equation:  1/x + 1 = 3   (the correct answer is x = 1/2)
    //   Action:    drag the "1" sitting on top of the fraction 1/x onto the whole
    //              left side.
    // Buggy versions OFFERED that drop and rewrote the equation to "(x + 1) / 1 = 3",
    // which solves to x = 2 — a wrong answer. The fix removes that drop target.
    const eq = parseEquation('1 / x + 1 = 3');
    const moves = generateValidMoves(eq, 'lhs/0/0'); // 'lhs/0/0' = the numerator 1 of 1/x

    // The corrupt destination — the whole left side — must NOT be offered.
    expect(moves['lhs']).toBeUndefined();
    // And the wrong result "(x + 1) / 1 = 3" must not appear among any offered move.
    const offered = Object.values(moves).map(equationToString);
    expect(offered).not.toContain('(x + 1) / 1 = 3');
  });

  test('#301 — every generated move is equivalent to the original equation', () => {
    // The invariant that would have caught the transpose bug: a move offered for
    // ANY source path must preserve the equation (same solution set).
    const equations = [
      '1 / m + 1 / (7 / 4) ^ 2 - 1 / (m * (7 / 4) ^ 2) = 2 / 5',
      '((2 * (n - 7 / 4) ^ 2 - 9 / 8) / 5 + n - 1) / ((n - 1) * n) = 2 / 5',
      'x + 2 = 5',
      'x * y = 7 - 3',
      '2 * (x + 3) = 10',
    ];
    const failures: string[] = [];
    for (const eqStr of equations) {
      const eq = parseEquation(eqStr);
      for (const path of getAllPaths(eq)) {
        const moves = generateValidMoves(eq, path);
        for (const [target, move] of Object.entries(moves)) {
          if (!areEquationsEquivalent(eq, move)) {
            failures.push(`${eqStr} | src=${path} tgt=${target} -> ${equationToString(move)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
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

  test('autoSimplify simplifies arithmetic fractions using GCD reduction instead of decimals', () => {
    const eq1 = parseEquation('x + 2 / 12 = 5');
    const simplified1 = autoSimplify(eq1);
    expect(equationToString(simplified1)).toBe('x + 1 / 6 = 5');

    const eq2 = parseEquation('x + 12 / 18 = 5');
    const simplified2 = autoSimplify(eq2);
    expect(equationToString(simplified2)).toBe('x + 2 / 3 = 5');

    const eq3 = parseEquation('x + 2 * (3 / 12) = 5');
    const simplified3 = autoSimplify(eq3);
    expect(equationToString(simplified3)).toBe('x + 1 / 2 = 5');

    // verify fallback behavior for roots
    const eq4 = parseEquation('x + sqrt(4) = 5');
    const simplified4 = autoSimplify(eq4);
    expect(equationToString(simplified4)).toBe('x + 2 = 5');

    // verify fraction reduction is NOT offered for decimal values
    const eqDecimal1 = parseEquation('x + 2.5 / 5 = 5');
    const simplifiedDecimal1 = autoSimplify(eqDecimal1);
    expect(equationToString(simplifiedDecimal1)).toBe('x + 0.5 = 5');

    const eqDecimal2 = parseEquation('x + 0.5 / 2 = 5');
    const simplifiedDecimal2 = autoSimplify(eqDecimal2);
    expect(equationToString(simplifiedDecimal2)).toBe('x + 0.25 = 5');

    // verify integer division simplifies to integer constant instead of fraction
    const eqInt = parseEquation('x + 6 / 2 = 5');
    const simplifiedInt = autoSimplify(eqInt);
    expect(equationToString(simplifiedInt)).toBe('x + 3 = 5');
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

  test('#89 — dragging a quadratic variable offers standard transposition, not a quadratic-formula override', () => {
    const eq = parseEquation('x ^ 2 + 5 * x + 6 = 0');

    // Dragging the linear term `5 * x` (lhs/0/1) must yield ordinary transposition
    // moves — not the single-positive-root quadratic-formula solve that used to
    // hijack every drag. The quadratic formula is offered only via getReducibleOptions.
    const linearTermMoves = generateValidMoves(eq, 'lhs/0/1');
    expect(linearTermMoves['rhs']).toBeDefined();
    expect(equationToString(linearTermMoves['rhs'])).toBe('x ^ 2 + 6 = 0 - 5 * x');

    // No drag on a quadratic may produce a quadratic-formula (sqrt discriminant) move.
    for (const path of ['lhs/0/1', 'lhs/0/1/1', 'lhs/1', 'lhs/0/0/0']) {
      for (const target of Object.values(generateValidMoves(eq, path))) {
        expect(equationToString(target)).not.toContain('sqrt');
      }
    }
  });

  test('getSimplificationForPath simplifies roots of matching powers correctly', () => {
    // 1. sqrt(x ^ 2) = |x| — even roots are NOT collapsed here (sign would be
    //    lost); they are offered as a ± branch via getReducibleOptions (#45).
    const eq1 = parseEquation('y = sqrt(x ^ 2)');
    expect(getSimplificationForPath(eq1, 'rhs')).toBeNull();

    // 2. nthRoot(x ^ 3, 3) -> x  (odd root is sign-safe, still collapses)
    const eq2 = parseEquation('y = nthRoot(x ^ 3, 3)');
    const simplified2 = getSimplificationForPath(eq2, 'rhs');
    expect(simplified2).not.toBeNull();
    expect(equationToString(simplified2!)).toBe('y = x');

    // 3. nthRoot(x ^ 2) (implicit degree 2) is even -> not collapsed (#45).
    const eq3 = parseEquation('y = nthRoot(x ^ 2)');
    expect(getSimplificationForPath(eq3, 'rhs')).toBeNull();

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

  test('autoSimplify simplifies powers of roots but preserves even roots of powers (#45)', () => {
    // Even root of a power keeps the sign — autoSimplify no longer collapses
    // sqrt((x+2)^2) to (x+2), which would silently drop the negative root (#45).
    const eq = parseEquation('y = sqrt((x + 2) ^ 2) - 2');
    expect(equationToString(autoSimplify(eq))).toBe('y = sqrt((x + 2) ^ 2) - 2');

    // Power of a root is sign-safe and still collapses: (sqrt(x+2))^2 -> x+2 -> x.
    const eq2 = parseEquation('y = sqrt(x + 2) ^ 2 - 2');
    expect(equationToString(autoSimplify(eq2))).toBe('y = x');
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

  test('distribution guards against unary minus factors (regression)', () => {
    // `-x * -1` / `3 * -1` have a unary-minus factor whose op is also '-'. It must
    // not be mistaken for a binary `(b - c)` — that previously threw inside
    // tryDistribution, swallowing the fold handle for `3 * -1` and crashing
    // autoSimplify on `-x * -1`.
    expect(equationToString(autoSimplify(parseEquation('y = -x * -1')))).toBe('y = x');
    expect(equationToString(autoSimplify(parseEquation('-x * -1 = 3 * -1')))).toBe('x = -3');

    // The negated-literal product is still offered as a per-node simplification.
    const folded = getSimplificationForPath(parseEquation('y = 3 * -1'), 'rhs');
    expect(folded).not.toBeNull();
    expect(equationToString(folded!)).toBe('y = -3');

    // Genuine distributions are unaffected.
    const dist = getSimplificationForPath(parseEquation('y = 2 * (x + 3)'), 'rhs');
    expect(dist).not.toBeNull();
    expect(equationToString(dist!)).toBe('y = 2 * x + 2 * 3');
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

  test('generateValidMoves does NOT offer quadratic formula for variables nested inside power nodes', () => {
    const eq1 = parseEquation('a * x^2 + b * x + c = 0');
    
    // Find path for 'x' dynamically - this will find the first 'x' which is inside x^2 (a power node)
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

    // The x is inside a power node (x^2), so it should NOT be draggable and should return no moves.
    // The quadratic formula is still available through getReducibleOptions (the identity/reduction system).
    const moves = generateValidMoves(eq1, xPath!);
    expect(Object.keys(moves).length).toBe(0);
  });

  test('regression: clicking y in x^2 + y^2 = r^2 should not produce quadratic formula', () => {
    const eq = parseEquation('x ^ 2 + y ^ 2 = r ^ 2');

    // Find the 'y' symbol path (nested inside y^2)
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

    const yPath = findPathForSymbol(eq.lhs, 'y', 'lhs');
    expect(yPath).not.toBeNull();

    // y is inside y^2 (a power node) - clicking it should produce NO moves
    const moves = generateValidMoves(eq, yPath!);
    expect(Object.keys(moves).length).toBe(0);
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

    // 4. Check transposition of division term in complex equation
    const eq5 = parseEquation('0 = (sqrt(-383) - 7) / x - 24');
    const eq6 = parseEquation('(sqrt(-383) - 7) / x = 24');
    expect(areEquationsEquivalent(eq5, eq6)).toBe(true);
  });
});

describe('hasValidMove — short-circuit existence check (#188)', () => {
  // hasValidMove must agree exactly with "generateValidMoves produced ≥1 move"
  // for every path, since it only short-circuits the existence query (it must not
  // change which paths are considered active).
  const equations = [
    'x + 3 = 7',
    'x = (-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)',
    '2 * x - 5 = 9',
    'x / 4 + 1 = 3',
    'x ^ 2 - 9 = 0',
    'a * x + b = c',
    '5 = 5',
    'sqrt(x) = 4',
  ];

  for (const eqStr of equations) {
    test(`agrees with generateValidMoves for every path of "${eqStr}"`, () => {
      const eq = parseEquation(eqStr);
      for (const path of getAllPaths(eq)) {
        const full = Object.keys(generateValidMoves(eq, path)).length > 0;
        expect(hasValidMove(eq, path)).toBe(full);
      }
    });
  }

  test('returns false for a node trapped inside a power/function (non-draggable)', () => {
    const eq = parseEquation('x ^ 2 = 9');
    // The exponent path is inside the power and cannot be dragged.
    expect(hasValidMove(eq, 'lhs/1')).toBe(false);
  });
});

describe('areEquationsEquivalent — reject pre-filter soundness (#188)', () => {
  // The cheap reject-only pre-filter must never drop a genuinely equivalent pair.
  // These pairs are equivalent yet have DIFFERENT gap functions (lhs - rhs), so a
  // naive gap comparison would wrongly reject them — they pin the pre-filter's
  // root-based soundness.
  const equivalentPairs: [string, string][] = [
    ['x = 3', '2 * x = 6'],
    ['x = 3', '1000 * x = 3000'],
    ['x + 2 = 5', 'x = 3'],
    ['x / 4 = 2', 'x = 8'],
    ['2 * x - 4 = 0', 'x = 2'],
    ['x = 3', 'x / 5 = 3 / 5'],
    ['x = (-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)', 'x * (2 * a) = -b - sqrt(b ^ 2 - 4 * a * c)'],
    ['3 * x + 6 = 12', 'x + 2 = 4'],
  ];

  for (const [a, b] of equivalentPairs) {
    test(`keeps equivalent pair "${a}" <=> "${b}"`, () => {
      expect(areEquationsEquivalent(parseEquation(a), parseEquation(b))).toBe(true);
    });
  }

  const differentPairs: [string, string][] = [
    ['x = 3', 'x = 4'],
    ['x + 2 = 5', 'x + 2 = 6'],
    ['2 * x = 6', 'x = 6'],
    ['x = 3', 'x = -3'],
  ];

  for (const [a, b] of differentPairs) {
    test(`rejects non-equivalent pair "${a}" vs "${b}"`, () => {
      expect(areEquationsEquivalent(parseEquation(a), parseEquation(b))).toBe(false);
    });
  }
});


