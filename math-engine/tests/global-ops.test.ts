import { parseEquation, equationToString, applyGlobalOp } from '../src';

const run = (input: string, params: Parameters<typeof applyGlobalOp>[1]) =>
  equationToString(applyGlobalOp(parseEquation(input), params));

describe('applyGlobalOp — operate on both sides', () => {
  it('square raises both sides to the 2nd power', () => {
    expect(run('x = 4', { type: 'square' })).toBe('x ^ 2 = 4 ^ 2');
  });

  it('power raises both sides to the given power', () => {
    expect(run('x = 4', { type: 'power', power: 3 })).toBe('x ^ 3 = 4 ^ 3');
  });

  it('sqrt takes the square root of both sides', () => {
    expect(run('x = 4', { type: 'sqrt' })).toBe('sqrt(x) = sqrt(4)');
  });

  it('root takes the nth root of both sides', () => {
    expect(run('x = 4', { type: 'root', power: 3 })).toBe('nthRoot(x, 3) = nthRoot(4, 3)');
  });

  it('add/sub/mul/div apply the term to both sides', () => {
    expect(run('x = 4', { type: 'add', term: '5' })).toBe('x + 5 = 4 + 5');
    expect(run('x = 4', { type: 'sub', term: '1' })).toBe('x - 1 = 4 - 1');
    expect(run('x = 4', { type: 'mul', term: '3' })).toBe('x * 3 = 4 * 3');
    expect(run('x = 4', { type: 'div', term: '2' })).toBe('x / 2 = 4 / 2');
  });

  it('throws when a binary op is requested without a term', () => {
    expect(() => applyGlobalOp(parseEquation('x = 4'), { type: 'mul' })).toThrow();
  });

  it('does not share node references between the two sides', () => {
    // Each side must own its own operand subtree (avoids shared-ref hazards
    // when ids are later assigned). Mutating one side must not affect the other.
    const out = applyGlobalOp(parseEquation('x = 4'), { type: 'mul', term: '3' });
    const lhsArgs = (out.lhs as any).args;
    const rhsArgs = (out.rhs as any).args;
    expect(lhsArgs[1]).not.toBe(rhsArgs[1]);
  });
});
