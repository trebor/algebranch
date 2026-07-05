import {
  parseEquation,
  equationToString,
  ensureNodeIds,
  generateValidMoves,
  getReducibleOptions,
  describeTransposition,
  describeReduction,
  describeGlobalOp,
  findMinimalChangedPath,
  StepChange,
} from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

const findOption = (s: string, label: string) =>
  Object.values(getReducibleOptions(eq(s))).flat().find((o) => o.label === label);

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

  it('minuend (head of a subtraction chain) across = becomes "subtract N from both sides" (#354)', () => {
    // a - b - c = d : the head `a` (lhs/0/0, left child of the innermost binary
    // minus) is a positive leading term, so moving it across `=` subtracts it.
    const change = describeTransposition(eq('a - b - c = d'), 'lhs/0/0', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'subtract', operand: 'a' });
    expect(change!.text).toBe('subtract a from both sides');
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

  it('entire side across = becomes "subtract [expression] from both sides"', () => {
    // -(x + 5) = x : transposing the entire RHS `x` (rhs) to the LHS
    const changeRhs = describeTransposition(eq('-(x + 5) = x'), 'rhs', 'lhs');
    expect(changeRhs).toMatchObject({ kind: 'bothSides', op: 'subtract', operand: 'x' });
    expect(changeRhs!.text).toBe('subtract x from both sides');

    // -(x + 5) = x : transposing the entire LHS `-(x + 5)` (lhs) to the RHS
    const changeLhs = describeTransposition(eq('-(x + 5) = x'), 'lhs', 'rhs');
    expect(changeLhs).toMatchObject({ kind: 'bothSides', op: 'subtract', operand: '-(x + 5)' });
    expect(changeLhs!.text).toBe('subtract -(x + 5) from both sides');
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
  it('a non-numeric simplify shows the before → after (parallel to evaluate)', () => {
    const e = eq('2 * x / 2 = 5');
    const simplified = eq('x = 5');
    const change = describeReduction(e, { path: 'lhs', simplified, type: 'reduce', label: 'Simplify' });
    expect(change).toMatchObject({ kind: 'rewrite', op: 'simplify' });
    expect(change.text).toBe('simplify 2 * x / 2 → x');
  });

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
  it('describes algebraic identities with natural texts', () => {
    const e = eq('x^2 + 5 * x + 6 = 0');
    const options = getReducibleOptions(e);
    const factorOption = Object.values(options).flat().find(o => o.label === 'Factor');
    expect(factorOption).toBeDefined();
    const change = describeReduction(e, factorOption!);
    expect(change).toMatchObject({
      kind: 'rewrite',
      op: 'identity',
      text: 'factor x ^ 2 + 5 * x + 6 → (x + 2) * (x + 3)'
    });
  });

  it('describes factor out GCF identity naturally', () => {
    const e = eq('6 * x^2 + 9 * x = 0');
    const options = getReducibleOptions(e);
    const gcfOption = Object.values(options).flat().find(o => o.label && o.label.startsWith('Factor out'));
    expect(gcfOption).toBeDefined();
    const change = describeReduction(e, gcfOption!);
    expect(change).toMatchObject({
      kind: 'rewrite',
      op: 'identity',
      text: 'factor out 3x from 6 * x ^ 2 + 9 * x → 3 * x * (2 * x + 3)'
    });
  });

  it('describes rationalizing a radical denominator with its own verb (#66)', () => {
    const e = eq('x = 1 / sqrt(2)');
    const option = findOption('x = 1 / sqrt(2)', 'Rationalize Denominator');
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    expect(change).toMatchObject({
      kind: 'rewrite',
      op: 'simplify',
      text: 'rationalize denominator 1 / sqrt(2) → sqrt(2) / 2'
    });
  });

  it('describes completing the square with its own verb (#62)', () => {
    const e = eq('x ^ 2 + 6 * x + 5 = 0');
    const option = findOption('x ^ 2 + 6 * x + 5 = 0', 'Complete the Square');
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    expect(change).toMatchObject({
      kind: 'rewrite',
      op: 'identity',
      text: 'complete the square x ^ 2 + 6 * x + 5 → (x + 3) ^ 2 - 4'
    });
  });
});

describe('domain restrictions when cancelling or dividing (#63)', () => {
  it('cancelling a variable factor records "assuming x ≠ 0"', () => {
    // m * x / x → m silently assumes x ≠ 0
    const e = eq('m * x / x = c');
    const option = findOption('m * x / x = c', 'Simplify Fraction');
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    // The restriction is carried structurally (not buried in the text prose) so
    // the UI can flag it prominently.
    expect(change.assumptions).toEqual(['x ≠ 0']);
    expect(change.text).toBe('simplify m * x / x → m');
  });

  it('a variable collapsing to a constant is a cancellation, never "evaluate x = 1"', () => {
    // The granular cancel option turns an x into 1; that is not constant folding.
    const e = eq('m * x * 1 / x + b / x = 4');
    const collapses = Object.values(getReducibleOptions(e))
      .flat()
      .map((o) => describeReduction(e, o))
      .filter((c) => c.kind === 'rewrite' && c.op === 'evaluate');
    // No evaluate step should claim a bare variable equals a constant.
    for (const c of collapses) {
      expect(c.text).not.toMatch(/evaluate [a-z] = /i);
    }
  });

  it('folding a genuinely constant subtree stays an evaluate with no assumption', () => {
    const e = eq('x = 11 - 4');
    const option = Object.values(getReducibleOptions(e)).flat().find((o) => o.path.startsWith('rhs'));
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    expect(change).toMatchObject({ kind: 'rewrite', op: 'evaluate' });
    expect(change.assumptions).toBeUndefined();
  });

  it('reducing a constant-denominator fraction adds no restriction', () => {
    // 2 * x / 2 → x : the denominator is the constant 2, no ≠0 assumption.
    const e = eq('2 * x / 2 = 5');
    const change = describeReduction(e, { path: 'lhs', simplified: eq('x = 5'), type: 'reduce', label: 'Simplify' });
    expect(change.text).toBe('simplify 2 * x / 2 → x');
    expect(change.assumptions).toBeUndefined();
  });

  it('dividing both sides by a variable factor (transposition) assumes it ≠ 0', () => {
    // a * x = b : moving the factor a across becomes "divide both sides by a"
    const change = describeTransposition(eq('a * x = b'), 'lhs/0', 'rhs');
    expect(change).toMatchObject({ kind: 'bothSides', op: 'divide', operand: 'a', assumptions: ['a ≠ 0'] });
    expect(change!.text).toBe('divide both sides by a');
  });

  it('dividing both sides by a constant carries no restriction', () => {
    const change = describeTransposition(eq('3 * x = 15'), 'lhs/0', 'rhs');
    expect(change!.text).toBe('divide both sides by 3');
    expect(change!.assumptions).toBeUndefined();
  });

  it('global-op divide by a variable assumes it ≠ 0; by a constant does not', () => {
    const byVar = describeGlobalOp({ type: 'div', term: 'x' });
    expect(byVar).toMatchObject({ op: 'divide', assumptions: ['x ≠ 0'] });
    expect(byVar.text).toBe('divide both sides by x');

    const byConst = describeGlobalOp({ type: 'div', term: '2' });
    expect(byConst.text).toBe('divide both sides by 2');
    expect(byConst.assumptions).toBeUndefined();
  });
});

describe('decomposed simplify steps read cleanly (#59)', () => {
  // Once the opaque collapse is gated, the remaining granular steps are tagged
  // at a removed leaf; the descriptor must still describe the affected
  // sub-expression, not the leaf alias ("simplify 1 → x").
  const optionByResult = (s: string, lhsResult: string) =>
    Object.values(getReducibleOptions(eq(s)))
      .flat()
      .find((o) => o.simplified.lhs.toString() === lhsResult);

  it('drop ×1 describes the affected product, not the removed leaf', () => {
    const e = eq('m * x * 1 / x + b / x = 4');
    const option = optionByResult('m * x * 1 / x + b / x = 4', 'm * x / x + b / x');
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    expect(change.text).toBe('simplify m * x * 1 → m * x');
    expect(change.assumptions).toBeUndefined();
  });

  it('cancel x/x describes the affected fraction and carries the ≠0 assumption', () => {
    const e = eq('m * x * 1 / x + b / x = 4');
    const option = optionByResult('m * x * 1 / x + b / x = 4', 'm * 1 + b / x');
    expect(option).toBeDefined();
    const change = describeReduction(e, option!);
    expect(change.text).toBe('simplify m * x * 1 / x → m * 1');
    expect(change.assumptions).toEqual(['x ≠ 0']);
  });

  it('findMinimalChangedPath walks up from a removed leaf to the affected subtree', () => {
    const e = eq('m * x * 1 / x + b / x = 4');
    // Dropping the ×1 is tagged at the leaf `1` (lhs/0/0/1) but the change is
    // contained in the product lhs/0/0.
    const dropOne = optionByResult('m * x * 1 / x + b / x = 4', 'm * x / x + b / x')!;
    expect(findMinimalChangedPath(e, dropOne.simplified, dropOne.path)).toBe('lhs/0/0');
  });
});

