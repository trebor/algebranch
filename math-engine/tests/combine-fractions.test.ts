import { parseEquation, getReducibleOptions, equationToString } from '../src';
import { tryCombineFractions } from '../src/simplify';
import { describeReduction } from '../src/describe';

/** Find the 'Combine Fractions' option anywhere in the reducible paths. */
const findCombine = (eqStr: string) => {
  const eq = parseEquation(eqStr);
  const reductions = getReducibleOptions(eq);
  for (const path of Object.keys(reductions)) {
    const opt = reductions[path].find((r) => r.label === 'Combine Fractions');
    if (opt) return { eq, opt };
  }
  return { eq, opt: undefined };
};

describe('Combine fractions over a common denominator (#61)', () => {
  test('symbolic denominators: 1/x + 1/y -> (y + x) / (x * y)', () => {
    const { opt } = findCombine('z = 1 / x + 1 / y');
    expect(opt).toBeDefined();
    expect(equationToString(opt!.simplified)).toBe('z = (y + x) / (x * y)');
  });

  test('numeric LCD: 2/3 + 1/6 reduces over the least common denominator', () => {
    const { opt } = findCombine('z = 2 / 3 + 1 / 6');
    expect(opt).toBeDefined();
    // LCD is 6 (not the product 18); numerator left as a foldable sum.
    expect(equationToString(opt!.simplified)).toBe('z = (4 + 1) / 6');
  });

  test('subtraction: a/b - c/d -> (a * d - c * b) / (b * d)', () => {
    const { opt } = findCombine('z = a / b - c / d');
    expect(opt).toBeDefined();
    expect(equationToString(opt!.simplified)).toBe('z = (a * d - c * b) / (b * d)');
  });

  test('three-way (n-way) sum of fractions combines into a single fraction', () => {
    const { eq, opt } = findCombine('z = 1 / x + 1 / y + 1 / w');
    expect(opt).toBeDefined();
    // Equivalent to the source and a single division node.
    const expr = opt!.simplified.rhs;
    expect(expr.type).toBe('OperatorNode');
    expect((expr as any).op).toBe('/');
    // sanity: equation still equivalent (engine validated it before offering)
    expect(equationToString(opt!.simplified)).toContain('/');
    expect(eq).toBeDefined();
  });

  test('denominators sharing factors use the LCD, not the product', () => {
    const { opt } = findCombine('z = 1 / 6 + 1 / 4');
    expect(opt).toBeDefined();
    // LCD(6, 4) = 12 -> (2 + 3) / 12, not (4 + 6) / 24.
    expect(equationToString(opt!.simplified)).toBe('z = (2 + 3) / 12');
  });

  test('mixed integer + fraction: 1/2 + 1 -> (1 + 2) / 2', () => {
    const { opt } = findCombine('z = 1 / 2 + 1');
    expect(opt).toBeDefined();
    expect(equationToString(opt!.simplified)).toBe('z = (1 + 2) / 2');
  });

  test('NOT offered on a non-fraction sum (x + 1)', () => {
    const { opt } = findCombine('z = x + 1');
    expect(opt).toBeUndefined();
  });

  test('NOT offered on a plain sum of variables (x + y)', () => {
    const { opt } = findCombine('z = x + y');
    expect(opt).toBeUndefined();
  });

  test('offered once on the maximal additive chain, not per nested sub-sum', () => {
    const eq = parseEquation('z = 1 / x + 1 / y + 1 / w');
    const reductions = getReducibleOptions(eq);
    const combineOpts = Object.values(reductions)
      .flat()
      .filter((r) => r.label === 'Combine Fractions');
    expect(combineOpts.length).toBe(1);
  });

  test('tryCombineFractions returns null for a single fraction (no sum)', () => {
    const eq = parseEquation('z = 1 / x');
    expect(tryCombineFractions(eq.rhs)).toBeNull();
  });

  test('emits the b·d ≠ 0 domain assumption for variable denominators', () => {
    const { eq, opt } = findCombine('z = 1 / x + 1 / y');
    expect(opt).toBeDefined();
    const change = describeReduction(eq, opt!);
    expect(change.assumptions).toEqual(expect.arrayContaining(['x ≠ 0', 'y ≠ 0']));
  });

  test('no domain assumption for purely numeric denominators', () => {
    const { eq, opt } = findCombine('z = 2 / 3 + 1 / 6');
    expect(opt).toBeDefined();
    const change = describeReduction(eq, opt!);
    expect(change.assumptions).toBeUndefined();
  });
});
