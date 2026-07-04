import {
  parseEquation,
  ensureNodeIds,
  equationToString,
  getSimplificationForPath,
  getReducibleOptions,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));
const norm = (s: string) => s.replace(/\s+/g, '');

describe('#333 — the simplifier must not offer an invalid x/0 -> 0 rewrite', () => {
  it('offers NO simplification for a variable over a literal zero (x / 0)', () => {
    const e = eq('y = x/0');
    expect(getSimplificationForPath(e, 'rhs')).toBeNull();

    // The mathjs fallback folds x/0 -> 0; make sure that never surfaces as an option.
    const results = Object.values(getReducibleOptions(e))
      .flat()
      .map((o) => norm(equationToString(o.simplified)));
    expect(results).not.toContain(norm('y = 0'));
  });

  it('offers NO simplification for a constant over zero (3 / 0)', () => {
    expect(getSimplificationForPath(eq('y = 3/0'), 'rhs')).toBeNull();
  });

  it('offers NO simplification for a sum over zero ((a + b) / 0)', () => {
    expect(getSimplificationForPath(eq('y = (a + b)/0'), 'rhs')).toBeNull();
  });

  it('offers NO simplification when the denominator folds to zero (x / (2 - 2))', () => {
    expect(getSimplificationForPath(eq('y = x/(2 - 2)'), 'rhs')).toBeNull();
  });

  it('leaves ordinary divisions untouched — a nonzero denominator still simplifies', () => {
    // (3*x - x)/5 distributes to 3*x/5 - x/5 — a legitimate move over a nonzero
    // denominator that must still be offered.
    const simplified = getSimplificationForPath(eq('y = (3*x - x)/5'), 'rhs');
    expect(simplified).not.toBeNull();
    expect(norm(equationToString(simplified!))).toBe(norm('y = 3 * x / 5 - x / 5'));
  });
});
