import * as math from 'mathjs';
import { evaluatePoint } from '../src/validator';

/**
 * Characterization tests for evaluatePoint's real↔complex boundary.
 *
 * evaluatePoint is the numeric hot path under the equivalence checker. It is
 * being optimized with a native-number fast path (#144), which MUST preserve
 * the exact behavior pinned here: native JS arithmetic on the all-real path,
 * and a mathjs Complex fallback wherever an operation genuinely yields a
 * complex value. These assertions capture the pre-optimization behavior so a
 * regression in complex handling surfaces immediately.
 */
const evalExpr = (expr: string, scope: Record<string, number> = {}) =>
  evaluatePoint(math.parse(expr), scope);

const isComplex = (x: any): x is { re: number; im: number } =>
  x != null && typeof x === 'object' && 're' in x && 'im' in x;

describe('evaluatePoint — real fast path', () => {
  test('returns a native number for all-real arithmetic', () => {
    const v = evalExpr('a + b * c', { a: 2, b: 3, c: 4 });
    expect(typeof v).toBe('number');
    expect(v).toBe(14);
  });

  test('subtraction, division and unary minus stay native numbers', () => {
    expect(evalExpr('a - b', { a: 7, b: 2 })).toBe(5);
    expect(evalExpr('a / b', { a: 1, b: 4 })).toBe(0.25);
    expect(evalExpr('-a', { a: 3 })).toBe(-3);
  });

  test('matches mathjs bit-for-bit on a non-trivial float expression', () => {
    const scope = { a: 1.7, b: 4.2, c: 2.9 };
    const expr = 'a / b - c * a + b / c';
    expect(evalExpr(expr, scope)).toBe(
      Number(math.subtract(
        math.add(math.divide(scope.a, scope.b), math.divide(scope.b, scope.c)),
        math.multiply(scope.c, scope.a)
      ))
    );
  });

  test('pi and e symbols resolve to their constants', () => {
    expect(evalExpr('pi')).toBeCloseTo(Math.PI, 12);
    expect(evalExpr('e')).toBeCloseTo(Math.E, 12);
  });
});

describe('evaluatePoint — power boundary', () => {
  test('integer powers stay native numbers (incl. negative base)', () => {
    expect(evalExpr('b ^ 2', { b: 3 })).toBe(9);
    expect(evalExpr('b ^ 3', { b: -2 })).toBe(-8);
  });

  test('positive base with fractional exponent stays a real number', () => {
    const v = evalExpr('b ^ y', { b: 2, y: 0.5 });
    expect(typeof v).toBe('number');
    expect(v).toBeCloseTo(Math.SQRT2, 12);
  });

  test('negative base with fractional exponent yields the complex principal root', () => {
    const v = evalExpr('b ^ y', { b: -8, y: 1 / 3 });
    expect(isComplex(v)).toBe(true);
    expect((v as any).re).toBeCloseTo(1, 9);
    expect((v as any).im).toBeCloseTo(Math.sqrt(3), 9);
  });
});

describe('evaluatePoint — sqrt boundary', () => {
  test('sqrt of a non-negative number stays a native number', () => {
    const v = evalExpr('sqrt(d)', { d: 9 });
    expect(typeof v).toBe('number');
    expect(v).toBe(3);
  });

  test('sqrt of a negative number yields a Complex value', () => {
    const v = evalExpr('sqrt(d)', { d: -4 });
    expect(isComplex(v)).toBe(true);
    expect((v as any).re).toBeCloseTo(0, 9);
    expect((v as any).im).toBeCloseTo(2, 9);
  });

  test('a discriminant going negative produces a complex root (quadratic case)', () => {
    // b^2 - 4ac < 0  →  sqrt is complex
    const v = evalExpr('sqrt(b ^ 2 - 4 * a * c)', { a: 1, b: 1, c: 1 });
    expect(isComplex(v)).toBe(true);
    expect((v as any).re).toBeCloseTo(0, 9);
    expect((v as any).im).toBeCloseTo(Math.sqrt(3), 9);
  });
});

describe('evaluatePoint — complex propagation', () => {
  test('a complex subterm propagates through subsequent real arithmetic', () => {
    const v = evalExpr('sqrt(d) + 1', { d: -4 });
    expect(isComplex(v)).toBe(true);
    expect((v as any).re).toBeCloseTo(1, 9);
    expect((v as any).im).toBeCloseTo(2, 9);
  });

  test('full quadratic-formula RHS evaluates to the expected complex root', () => {
    // x = (-b - sqrt(b^2-4ac)) / (2a), with a=b=c=1 → (-1 - i√3)/2
    const v = evalExpr('(-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)', { a: 1, b: 1, c: 1 });
    expect(isComplex(v)).toBe(true);
    expect((v as any).re).toBeCloseTo(-0.5, 9);
    expect((v as any).im).toBeCloseTo(-Math.sqrt(3) / 2, 9);
  });
});
