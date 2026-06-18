import { parseEquation, ensureNodeIds, equationToString, getReducibleOptions } from '../src';
import { analyzeRootOfPower, trySimplifyRootOfPower } from '../src/simplify';

const eq = (s: string) => ensureNodeIds(parseEquation(s));
const norm = (s: string) => s.replace(/\s+/g, '');

describe('#45 — even roots offer a ± branch instead of dropping the negative root', () => {
  it('sqrt(x^2) = sqrt(9) offers both +x and -x options', () => {
    const options = getReducibleOptions(eq('sqrt(x ^ 2) = sqrt(9)'));
    const lhsOpts = Object.entries(options)
      .filter(([path]) => path === 'lhs')
      .flatMap(([, opts]) => opts);
    const results = lhsOpts.map((o) => norm(equationToString(o.simplified)));
    expect(results).toContain(norm('x = sqrt(9)'));
    expect(results).toContain(norm('-x = sqrt(9)'));
  });

  it('labels the ± branch with Title-Case "Take Root (±)" to match its coarse-label peers', () => {
    const opts = Object.values(getReducibleOptions(eq('sqrt(x ^ 2) = sqrt(9)'))).flat();
    const rootLabels = opts.map((o) => o.label).filter((l) => l?.startsWith('Take Root'));
    expect(rootLabels).toEqual(expect.arrayContaining(['Take Root (+)', 'Take Root (-)']));
  });

  it('does NOT silently collapse sqrt(x^2) to x via the single-simplify path', () => {
    // trySimplifyRootOfPower returns null for even roots now (handled by the ± branch).
    expect(trySimplifyRootOfPower(eq('sqrt(x ^ 2) = 0').lhs)).toBeNull();
  });

  it('odd roots stay sign-safe (single simplify, no ±)', () => {
    const node = eq('nthRoot(x ^ 3, 3) = 8').lhs;
    const analysis = analyzeRootOfPower(node);
    expect(analysis).toMatchObject({ even: false });
    // odd root collapses to x directly
    expect(equationToString({ lhs: trySimplifyRootOfPower(node)!, rhs: node })).toContain('x');
    // and getReducibleOptions does not add Take Root (±) for it
    const opts = Object.values(getReducibleOptions(eq('nthRoot(x ^ 3, 3) = 8'))).flat();
    expect(opts.some((o) => o.label?.startsWith('Take Root'))).toBe(false);
  });

  it('analyzeRootOfPower classifies parity correctly', () => {
    expect(analyzeRootOfPower(eq('sqrt(x ^ 2) = 0').lhs)).toMatchObject({ even: true });
    expect(analyzeRootOfPower(eq('nthRoot(x ^ 4, 4) = 0').lhs)).toMatchObject({ even: true });
    expect(analyzeRootOfPower(eq('nthRoot(x ^ 3, 3) = 0').lhs)).toMatchObject({ even: false });
  });
});
