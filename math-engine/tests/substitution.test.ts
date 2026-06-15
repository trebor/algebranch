import {
  parseEquation,
  ensureNodeIds,
  equationToString,
  getIsolatedDefinition,
  getSubstitutionOptions,
  describeSubstitution,
  SubstitutionFact,
  getCombineOptions,
  describeCollapse,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));
const norm = (s: string) => s.replace(/\s+/g, '');

const fact = (s: string, sourceName = 'other tab'): SubstitutionFact => {
  const def = getIsolatedDefinition(eq(s));
  if (!def) throw new Error(`not an isolated definition: ${s}`);
  return { ...def, sourceName };
};

describe('getIsolatedDefinition — what counts as a usable fact', () => {
  it('detects lhs isolation: y = 2x + 1', () => {
    const def = getIsolatedDefinition(eq('y = 2 * x + 1'));
    expect(def?.variable).toBe('y');
    expect(norm(def!.expression.toString())).toBe(norm('2 * x + 1'));
  });

  it('detects rhs isolation: 2x + 1 = y', () => {
    const def = getIsolatedDefinition(eq('2 * x + 1 = y'));
    expect(def?.variable).toBe('y');
  });

  it('rejects self-referential "isolation": y = y + 1', () => {
    const getIsolated = getIsolatedDefinition(eq('y = y + 1'));
    expect(getIsolated).toBeNull();
  });

  it('accepts rhs bare variable even with work on the left: 2y = x isolates x', () => {
    const def = getIsolatedDefinition(eq('2 * y = x'));
    expect(def?.variable).toBe('x');
  });

  it('rejects non-isolated equations', () => {
    expect(getIsolatedDefinition(eq('x + 2 = 5'))).toBeNull();
    expect(getIsolatedDefinition(eq('2 * y = x + 1'))).toBeNull();
  });

  it('rejects constants pi/e as "variables"', () => {
    expect(getIsolatedDefinition(eq('pi = 3'))).toBeNull();
  });
});

describe('getSubstitutionOptions — forward substitution', () => {
  it('offers substitution at every matching variable occurrence, replacing all instances', () => {
    const options = getSubstitutionOptions(eq('3 * y + y = 12'), [fact('y = 2 * x + 1')]);
    const paths = Object.keys(options);
    expect(paths).toHaveLength(2); // both y occurrences

    for (const opts of Object.values(options)) {
      expect(opts).toHaveLength(1);
    }
    const results = Object.values(options).flat().map(o => norm(equationToString(o.substituted)));
    // All occurrences should be replaced in each option's substituted equation.
    expect(results[0]).toBe(norm('3 * (2 * x + 1) + 2 * x + 1 = 12'));
    expect(results[1]).toBe(norm('3 * (2 * x + 1) + 2 * x + 1 = 12'));
  });

  it('does not parenthesize single-node replacements', () => {
    const options = getSubstitutionOptions(eq('3 * y = 12'), [fact('y = 5')]);
    const results = Object.values(options).flat().map(o => norm(equationToString(o.substituted)));
    expect(results).toContain(norm('3 * 5 = 12'));
  });

  it('returns nothing when the variable does not occur', () => {
    expect(getSubstitutionOptions(eq('3 * z = 12'), [fact('y = 2 * x')])).toEqual({});
  });

  it('offers multiple options on one node when two facts define the same variable', () => {
    const options = getSubstitutionOptions(eq('y + 1 = 4'), [
      fact('y = 2 * x', 'tab A'),
      fact('y = z - 3', 'tab B'),
    ]);
    const yPath = Object.keys(options)[0];
    expect(options[yPath]).toHaveLength(2);
    expect(options[yPath].map(o => o.fact.sourceName).sort()).toEqual(['tab A', 'tab B']);
  });

  it('carries the fact and a parsable replacement string on each option', () => {
    const options = getSubstitutionOptions(eq('y + 1 = 4'), [fact('y = 2 * x')]);
    const opt = Object.values(options).flat()[0];
    expect(opt.variable).toBe('y');
    expect(norm(opt.replacement)).toBe(norm('2 * x'));
    // replacement round-trips through the parser (strictly symbolic, like #42 operands)
    expect(norm(equationToString(parseEquation(`q = ${opt.replacement}`)))).toBe(norm(`q = ${opt.replacement}`));
  });
});

describe('getCombineOptions — reverse substitution (collapse)', () => {
  it('offers collapse at a matching sub-expression path', () => {
    const options = getCombineOptions(eq('y = m * c ^ 2'), [fact('E = m * c ^ 2')]);
    const paths = Object.keys(options);
    expect(paths).toContain('rhs');

    const opt = options['rhs'][0];
    expect(opt.variable).toBe('E');
    expect(norm(equationToString(opt.substituted))).toBe(norm('y = E'));
    expect(opt.type).toBe('reverse');
  });

  it('supports commutative matching for addition and multiplication', () => {
    const options = getCombineOptions(eq('y = c ^ 2 * m'), [fact('E = m * c ^ 2')]);
    const paths = Object.keys(options);
    expect(paths).toContain('rhs');

    const opt = options['rhs'][0];
    expect(opt.variable).toBe('E');
    expect(norm(equationToString(opt.substituted))).toBe(norm('y = E'));
  });

  it('supports parenthesized expression matching', () => {
    const options = getCombineOptions(eq('y = (m * c ^ 2)'), [fact('E = m * c ^ 2')]);
    const paths = Object.keys(options);
    expect(paths).toContain('rhs');

    const opt = options['rhs'][0];
    expect(opt.variable).toBe('E');
    expect(norm(equationToString(opt.substituted))).toBe(norm('y = E'));
  });

  it('returns nothing when there are no matches', () => {
    expect(getCombineOptions(eq('y = m * c'), [fact('E = m * c ^ 2')])).toEqual({});
  });
});

describe('describeSubstitution — StepChange for the transcript / history tree', () => {
  it('emits a substitute rewrite with symbolic detail', () => {
    const change = describeSubstitution('y', '2 * x + 1');
    expect(change).toMatchObject({ kind: 'rewrite', op: 'substitute' });
    expect(change.text).toBe('substitute y = 2 * x + 1');
    expect((change as any).detail).toBe('y → 2 * x + 1');
  });
});

describe('describeCollapse — StepChange for reverse substitution', () => {
  it('emits a collapse rewrite with symbolic detail', () => {
    const change = describeCollapse('m * c ^ 2', 'E');
    expect(change).toMatchObject({ kind: 'rewrite', op: 'substitute' });
    expect(change.text).toBe('collapse m * c ^ 2 to E');
    expect((change as any).detail).toBe('m * c ^ 2 → E');
  });
});
