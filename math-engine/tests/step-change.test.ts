import {
  parseEquation,
  equationToString,
  ensureNodeIds,
  generateValidMoves,
  getReducibleOptions,
  describeTransposition,
  describeReduction,
  describeGlobalOp,
  StepChange,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

describe('describeTransposition — both-sides operations', () => {
  it('addend across = becomes "subtract N from both sides"', () => {
    // x + 4 = 11 : the 4 (lhs/1) moves to the RHS root
    const change = describeTransposition(eq('x + 4 = 11'), 'lhs/1', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'subtract', operand: '4' });
    expect(change!.text).toBe('subtract 4 from both sides');
  });

  it('subtrahend across = becomes "add N to both sides"', () => {
    // 3 * x - 4 = 11 : the 4 (lhs/1, right child of binary minus)
    const change = describeTransposition(eq('3 * x - 4 = 11'), 'lhs/1', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'add', operand: '4' });
    expect(change!.text).toBe('add 4 to both sides');
  });

  it('factor across = becomes "divide both sides by N"', () => {
    // 3 * x = 15 : the 3 (lhs/0)
    const change = describeTransposition(eq('3 * x = 15'), 'lhs/0', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'divide', operand: '3' });
    expect(change!.text).toBe('divide both sides by 3');
  });

  it('denominator across = becomes "multiply both sides by N"', () => {
    // x / 5 = 2 : the 5 (lhs/1, denominator)
    const change = describeTransposition(eq('x / 5 = 2'), 'lhs/1', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'multiply', operand: '5' });
    expect(change!.text).toBe('multiply both sides by 5');
  });

  it('operand is strictly parsable/symbolic (round-trips through the parser, not NL)', () => {
    // The operand must be a symbolic expression suitable for formal rendering,
    // never natural-language text. Prove it round-trips through parseEquation.
    for (const [input, src] of [['3 * x = 15', 'lhs/0'], ['x / 5 = 2', 'lhs/1']] as const) {
      const change = describeTransposition(eq(input), src, 'rhs');
      expect(change!.kind).toBe('bothSides');
      const operand = (change as Extract<StepChange, { kind: 'bothSides' }>).operand;
      // Parses cleanly and serializes back to the same symbolic form.
      expect(equationToString(parseEquation(`y = ${operand}`))).toBe(`y = ${operand}`);
    }
  });

  it('same-side rearrangement returns null (not a clean both-sides op)', () => {
    // moving within the same side is not a both-sides operation
    const change = describeTransposition(eq('x + 4 = 11'), 'lhs/1', 'lhs/0');
    expect(change).toBeNull();
  });

  it('descriptors line up with a real generateValidMoves cross-equals target', () => {
    const e = eq('x + 4 = 11');
    const moves = generateValidMoves(e, 'lhs/1');
    // The cross-equals destination is the RHS root.
    expect(Object.keys(moves)).toContain('rhs');
    const change = describeTransposition(e, 'lhs/1', 'rhs');
    expect(change!.op).toBe('subtract');
  });
});

describe('describeGlobalOp — both-sides radial-menu ops', () => {
  it('binary ops map to add/subtract/multiply/divide with the term as operand', () => {
    expect(describeGlobalOp({ type: 'add', term: '5' })).toMatchObject({ kind: 'bothSides', op: 'add', operand: '5', text: 'add 5 to both sides' });
    expect(describeGlobalOp({ type: 'sub', term: '1' })).toMatchObject({ op: 'subtract', text: 'subtract 1 from both sides' });
    expect(describeGlobalOp({ type: 'mul', term: '3' })).toMatchObject({ op: 'multiply', text: 'multiply both sides by 3' });
    expect(describeGlobalOp({ type: 'div', term: '2' })).toMatchObject({ op: 'divide', text: 'divide both sides by 2' });
  });

  it('square / power map to op "power" with the exponent as operand', () => {
    expect(describeGlobalOp({ type: 'square' })).toMatchObject({ op: 'power', operand: '2', text: 'square both sides' });
    expect(describeGlobalOp({ type: 'power', power: 3 })).toMatchObject({ op: 'power', operand: '3', text: 'cube both sides' });
    expect(describeGlobalOp({ type: 'power', power: 4 })).toMatchObject({ op: 'power', operand: '4', text: 'raise both sides to the power of 4' });
  });

  it('sqrt / root map to op "root" with the index as operand', () => {
    expect(describeGlobalOp({ type: 'sqrt' })).toMatchObject({ op: 'root', operand: '2', text: 'take the square root of both sides' });
    expect(describeGlobalOp({ type: 'root', power: 3 })).toMatchObject({ op: 'root', operand: '3', text: 'take the cube root of both sides' });
  });

  it('operand is strictly parsable (round-trips through the parser)', () => {
    const operand = (describeGlobalOp({ type: 'mul', term: '3' }) as Extract<StepChange, { kind: 'bothSides' }>).operand;
    expect(equationToString(parseEquation(`y = ${operand}`))).toBe(`y = ${operand}`);
  });

  it('throws when a binary op is described without a term', () => {
    expect(() => describeGlobalOp({ type: 'mul' })).toThrow();
  });
});

describe('describeReduction — in-place rewrites', () => {
  it('numeric evaluation describes the before → after', () => {
    // 11 - 4 on the RHS simplifies to 15
    const e = eq('x = 11 - 4');
    const options = getReducibleOptions(e);
    const rhsOption = Object.values(options).flat().find(o => o.path.startsWith('rhs'));
    expect(rhsOption).toBeDefined();
    const change: StepChange = describeReduction(e, rhsOption!);
    expect(change.kind).toBe('rewrite');
    expect(['evaluate', 'simplify']).toContain((change as any).op);
  });
});
