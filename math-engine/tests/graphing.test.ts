import {
  parseEquation,
  ensureNodeIds,
  getGraphVariables,
  sampleCurve,
  findIntersections,
  computeGraphData,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));
const expr = (s: string) => ensureNodeIds(parseEquation(`q = ${s}`)).rhs;

// Sorted, rounded set comparison for numeric root sets.
const expectRoots = (got: number[], expected: number[]) => {
  expect(got.length).toBe(expected.length);
  const g = [...got].sort((a, b) => a - b);
  const e = [...expected].sort((a, b) => a - b);
  g.forEach((v, i) => expect(v).toBeCloseTo(e[i], 4));
};

describe('getGraphVariables — real variables only', () => {
  it('does NOT treat function names as variables (sqrt gotcha)', () => {
    expect(getGraphVariables(eq('sqrt(x ^ 2) = sqrt(9)'))).toEqual(['x']);
  });
  it('collects every distinct variable', () => {
    expect([...getGraphVariables(eq('E = m * c ^ 2'))].sort()).toEqual(['E', 'c', 'm']);
  });
  it('returns nothing for a constant equation', () => {
    expect(getGraphVariables(eq('3 = 3'))).toEqual([]);
  });
});

describe('sampleCurve', () => {
  it('samples a linear expression exactly', () => {
    const samples = sampleCurve(expr('3 * x - 4'), 'x', 0, 4, 5); // x = 0,1,2,3,4
    expect(samples.map((s) => s.y)).toEqual([-4, -1, 2, 5, 8]);
  });
  it('marks undefined points (sqrt of negative) as null breaks', () => {
    const samples = sampleCurve(expr('sqrt(x)'), 'x', -4, 4, 9); // x = -4..4 step 1
    const neg = samples.filter((s) => s.x < 0);
    const nonneg = samples.filter((s) => s.x >= 0);
    expect(neg.every((s) => s.y === null)).toBe(true);
    expect(nonneg.every((s) => typeof s.y === 'number')).toBe(true);
  });
});

describe('findIntersections', () => {
  it('linear: one solution', () => {
    expectRoots(findIntersections(eq('3 * x - 4 = 11'), 'x', -10, 10), [5]);
  });
  it('quadratic: two solutions', () => {
    expectRoots(findIntersections(eq('x ^ 2 = 9'), 'x', -10, 10), [-3, 3]);
  });
  it('no solution (parallel)', () => {
    expectRoots(findIntersections(eq('x = x + 1'), 'x', -10, 10), []);
  });
  it('tangency: a double root with no sign change', () => {
    expectRoots(findIntersections(eq('x ^ 2 = 0'), 'x', -10, 10), [0]);
  });
});

describe('derivation-chain invariance — the central promise', () => {
  const roots = (s: string) => computeGraphData(eq(s)).intersections;

  it('Ch1 linear: solution {5} at every step (curves morph, x is fixed)', () => {
    ['3 * x - 4 = 11', '3 * x = 11 + 4', '3 * x = 15', 'x = 15 / 3', 'x = 5'].forEach((s) =>
      expectRoots(roots(s), [5]),
    );
  });

  it('Ch2 quadratic: {-3,3} survives global sqrt, drops to {3} only at the +branch', () => {
    expectRoots(roots('x ^ 2 - 9 = 0'), [-3, 3]);
    expectRoots(roots('x ^ 2 = 9'), [-3, 3]);
    expectRoots(roots('sqrt(x ^ 2) = sqrt(9)'), [-3, 3]);
    expectRoots(roots('x = sqrt(9)'), [3]);
    expectRoots(roots('x = 3'), [3]);
  });

  it('Ch5 substitution: variable and solution change at the substitution step', () => {
    const d0 = computeGraphData(eq('y + 4 = 10'));
    expect(d0.variable).toBe('y');
    expectRoots(d0.intersections, [6]);
    const d1 = computeGraphData(eq('2 * x + 4 = 10'));
    expect(d1.variable).toBe('x');
    expectRoots(d1.intersections, [3]);
  });
});

describe('computeGraphData', () => {
  it('flags multi-variable equations as not graphable', () => {
    const data = computeGraphData(eq('E = m * c ^ 2'));
    expect(data.variable).toBeNull();
    expect(data.reason).toBe('multi-variable');
    expect([...data.variables].sort()).toEqual(['E', 'c', 'm']);
  });

  it('flags constant equations as no-variables', () => {
    expect(computeGraphData(eq('3 = 3')).reason).toBe('no-variables');
  });

  it('produces a window containing all intersections and y = 0', () => {
    const data = computeGraphData(eq('x ^ 2 = 9'));
    expect(data.variable).toBe('x');
    for (const ix of data.intersections) {
      expect(ix).toBeGreaterThanOrEqual(data.window.xMin);
      expect(ix).toBeLessThanOrEqual(data.window.xMax);
    }
    expect(data.window.yMin).toBeLessThanOrEqual(0);
    expect(data.window.yMax).toBeGreaterThanOrEqual(0);
    expect(data.lhs.length).toBeGreaterThan(0);
    expect(data.rhs.length).toBeGreaterThan(0);
  });
});
