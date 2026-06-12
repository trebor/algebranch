import * as math from 'mathjs';
import { parseEquation, ensureNodeIds, getQuadraticFormulaSolutions, evaluatePoint } from '../src';
import type { Equation } from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

// The formula side is the one that isn't just the solve variable.
const formulaValue = (solEq: Equation, solveVar: string): any => {
  const isVar = (n: math.MathNode) => n.type === 'SymbolNode' && (n as math.SymbolNode).name === solveVar;
  const node = isVar(solEq.lhs) ? solEq.rhs : solEq.lhs;
  return evaluatePoint(node, {});
};

// True if substituting `value` for solveVar makes lhs == rhs (handles complex).
const satisfies = (original: Equation, solveVar: string, value: any): boolean => {
  const scope = { [solveVar]: value } as Record<string, number>;
  const diff = math.subtract(evaluatePoint(original.lhs, scope), evaluatePoint(original.rhs, scope));
  return Number(math.abs(diff)) < 1e-6;
};

// Assert both formula branches are real roots that satisfy the original equation.
const expectRealRootsSatisfy = (s: string, solveVar = 'x', expectedRoots?: number[]) => {
  const original = eq(s);
  const sols = getQuadraticFormulaSolutions(original).filter((q) => q.solveVar === solveVar);
  expect(sols).toHaveLength(1);
  const { pos, neg } = sols[0];
  const rootPos = formulaValue(pos, solveVar);
  const rootNeg = formulaValue(neg, solveVar);
  expect(satisfies(original, solveVar, rootPos)).toBe(true);
  expect(satisfies(original, solveVar, rootNeg)).toBe(true);
  if (expectedRoots) {
    const got = [Number(rootPos), Number(rootNeg)].sort((a, b) => a - b);
    const want = [...expectedRoots].sort((a, b) => a - b);
    got.forEach((g, i) => expect(g).toBeCloseTo(want[i], 6));
  }
};

describe('#40 — quadratic formula identity validation', () => {
  it('monic, positive distinct roots', () => {
    expectRealRootsSatisfy('x ^ 2 - 5 * x + 6 = 0', 'x', [2, 3]);
  });

  it('mixed-sign roots (negative constant term)', () => {
    expectRealRootsSatisfy('x ^ 2 + x - 6 = 0', 'x', [2, -3]);
  });

  it('leading negative coefficient', () => {
    expectRealRootsSatisfy('-x ^ 2 + 5 * x - 6 = 0', 'x', [2, 3]);
  });

  it('non-monic (a != 1)', () => {
    expectRealRootsSatisfy('2 * x ^ 2 - 4 * x - 6 = 0', 'x', [3, -1]);
  });

  it('equation not in = 0 form (terms on both sides)', () => {
    expectRealRootsSatisfy('x ^ 2 = 5 * x - 6', 'x', [2, 3]);
  });

  it('quadratic on the RHS', () => {
    expectRealRootsSatisfy('0 = x ^ 2 - 5 * x + 6', 'x', [2, 3]);
  });

  it('complex roots (negative discriminant) still satisfy the equation', () => {
    const original = eq('x ^ 2 + x + 1 = 0'); // discriminant = -3
    const sols = getQuadraticFormulaSolutions(original);
    expect(sols).toHaveLength(1);
    const rootPos = formulaValue(sols[0].pos, 'x');
    const rootNeg = formulaValue(sols[0].neg, 'x');
    expect(math.typeOf(rootPos)).toBe('Complex');
    expect(satisfies(original, 'x', rootPos)).toBe(true);
    expect(satisfies(original, 'x', rootNeg)).toBe(true);
  });

  it('double root (discriminant = 0)', () => {
    // x^2 - 2x + 1 = 0 -> (x-1)^2, double root x = 1
    expectRealRootsSatisfy('x ^ 2 - 2 * x + 1 = 0', 'x', [1, 1]);
  });

  describe('skip / reject cases', () => {
    it('no linear term (b = 0) is skipped — solved by isolation instead', () => {
      expect(getQuadraticFormulaSolutions(eq('x ^ 2 - 9 = 0'))).toHaveLength(0);
    });

    it('linear equation has no quadratic solutions', () => {
      expect(getQuadraticFormulaSolutions(eq('x + 5 = 0'))).toHaveLength(0);
    });

    it('higher-degree term is unsupported (no false positive)', () => {
      expect(getQuadraticFormulaSolutions(eq('x ^ 3 - x + 1 = 0'))).toHaveLength(0);
    });
  });
});
