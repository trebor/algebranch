import {
  parseEquation,
  ensureNodeIds,
  equationToString,
  getSimplificationForPath,
  getReducibleOptions,
  areExpressionsValueEqual,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));
const expr = (s: string) => ensureNodeIds(parseEquation(`y = ${s}`)).rhs;
const norm = (s: string) => s.replace(/\s+/g, '');

describe('#33 — node removal must be a local identity, not an equation-structure coincidence', () => {
  it('does not offer a "simplify" that clears a denominator constant when the other side is 0', () => {
    const e = eq('(3 * x ^ 2 + x - 2) / 5 = 0'); // the 5 is at lhs/1
    expect(getSimplificationForPath(e, 'lhs/1')).toBeNull();

    const results = Object.values(getReducibleOptions(e))
      .flat()
      .map((o) => norm(equationToString(o.simplified)));
    expect(results).not.toContain(norm('3 * x ^ 2 + x - 2 = 0'));
  });

  it('does not offer removing a VARIABLE denominator (would drop x != 0)', () => {
    const e = eq('(3 * x ^ 2 + x - 2) / x = 0');
    expect(getSimplificationForPath(e, 'lhs/1')).toBeNull();
  });

  it('areExpressionsValueEqual distinguishes a true identity from a structural coincidence', () => {
    expect(areExpressionsValueEqual(expr('x + 0'), expr('x'))).toBe(true);
    expect(areExpressionsValueEqual(expr('x * 1'), expr('x'))).toBe(true);
    expect(areExpressionsValueEqual(expr('(3 * x ^ 2 + x - 2) / 5'), expr('3 * x ^ 2 + x - 2'))).toBe(false);
    expect(areExpressionsValueEqual(expr('2 * x'), expr('x'))).toBe(false);
  });
});
