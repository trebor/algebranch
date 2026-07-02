import { parseEquation, getNodeByPath } from '../src';
import { isCommutativeChainLink, flattenAssociativeChain } from '../src/explore';

// Resolve a node and its immediate parent from a path, then apply the predicate.
// The parent is the node one path segment up (null for a side root).
const linkAt = (eqStr: string, path: string): boolean => {
  const eq = parseEquation(eqStr);
  const node = getNodeByPath(eq, path);
  const parts = path.split('/');
  const parent = parts.length > 1 ? getNodeByPath(eq, parts.slice(0, -1).join('/')) : null;
  return isCommutativeChainLink(node, parent);
};

describe('isCommutativeChainLink — flatten associative same-operator chains (#290)', () => {
  // `a + b + c` parses to `+[+[a,b],c]`; the inner `+` at lhs/0 is the arbitrary link.
  it('flags the inner + of a sum chain', () => {
    expect(linkAt('a + b + c = 0', 'lhs/0')).toBe(true);
  });

  // `x * y * z` parses to `*[*[x,y],z]`; the inner `*` at lhs/0 is the arbitrary link.
  it('flags the inner * of a product chain', () => {
    expect(linkAt('x * y * z = 0', 'lhs/0')).toBe(true);
  });

  // `a + b + c + d` = `+[+[+[a,b],c],d]` — both nested +'s are links.
  it('flags every inner + of a longer sum chain', () => {
    expect(linkAt('a + b + c + d = 0', 'lhs/0')).toBe(true);
    expect(linkAt('a + b + c + d = 0', 'lhs/0/0')).toBe(true);
  });

  it('never flags the chain root itself (has no same-op parent)', () => {
    expect(linkAt('a + b + c = 0', 'lhs')).toBe(false);
  });

  it('never flags a leaf', () => {
    expect(linkAt('a + b + c = 0', 'lhs/1')).toBe(false); // c
    expect(linkAt('a + b + c = 0', 'lhs/0/0')).toBe(false); // a
  });

  // `-` and `/` are NOT associative — their chains must never flatten.
  it('never flags a subtraction chain link', () => {
    expect(linkAt('a - b - c = 0', 'lhs/0')).toBe(false);
  });

  it('never flags a division chain link', () => {
    expect(linkAt('a / b / c = 0', 'lhs/0')).toBe(false);
  });

  // `a + b*c` = `+[a,*[b,c]]` — the product child stays whole (precedence boundary).
  it('never flags a product nested under a sum', () => {
    expect(linkAt('a + b * c = 0', 'lhs/1')).toBe(false);
  });

  // `a - b + c` = `+[-[a,b],c]` — the subtraction stays its own stop under the sum.
  it('never flags a subtraction nested under a sum', () => {
    expect(linkAt('a - b + c = 0', 'lhs/0')).toBe(false);
  });

  // `a + (b + c)` = `+[a,(+[b,c])]` — the parenthesised sum's parent is a
  // ParenthesisNode, not a +, so explicit grouping survives.
  it('never flags a parenthesised sum (explicit grouping preserved)', () => {
    expect(linkAt('a + (b + c) = 0', 'lhs/1/0')).toBe(false);
  });

  // `^` is right-associative and non-commutative — never a chain link.
  it('never flags a power', () => {
    expect(linkAt('a ^ b ^ c = 0', 'lhs/0')).toBe(false);
  });

  it('returns false when the parent is null', () => {
    const eq = parseEquation('a + b = 0');
    expect(isCommutativeChainLink(getNodeByPath(eq, 'lhs'), null)).toBe(false);
  });
});

describe('flattenAssociativeChain — flat operands of a same-op chain (#353 WB)', () => {
  const flat = (eqStr: string) =>
    flattenAssociativeChain(parseEquation(eqStr).lhs, 'lhs');

  it('flattens a sum chain to its ordered operand paths (uneven depths)', () => {
    // `a+b+c` = `+[+[a,b],c]` → operands a,b,c; the inner `+` (lhs/0) is a link.
    expect(flat('a + b + c = 0')).toEqual({
      operandPaths: ['lhs/0/0', 'lhs/0/1', 'lhs/1'],
      linkPaths: ['lhs/0'],
    });
  });

  it('flattens a longer chain, collecting every collapsed link', () => {
    expect(flat('a + b + c + d = 0')).toEqual({
      operandPaths: ['lhs/0/0/0', 'lhs/0/0/1', 'lhs/0/1', 'lhs/1'],
      linkPaths: ['lhs/0', 'lhs/0/0'],
    });
  });

  it('flattens a product chain', () => {
    expect(flat('x * y * z = 0')).toEqual({
      operandPaths: ['lhs/0/0', 'lhs/0/1', 'lhs/1'],
      linkPaths: ['lhs/0'],
    });
  });

  it('keeps a nested product whole (precedence boundary stops the walk)', () => {
    // `a + b*c + d` = `+[+[a,*[b,c]],d]` — the product at lhs/0/1 is one operand.
    expect(flat('a + b * c + d = 0')).toEqual({
      operandPaths: ['lhs/0/0', 'lhs/0/1', 'lhs/1'],
      linkPaths: ['lhs/0'],
    });
  });

  it('flattens a redundant same-op paren but not across it', () => {
    // `a + (b + c)` strips the redundant paren to `+[a,+[b,c]]`, so it flattens
    // to a,b,c (three operands) — mathematically `a+b+c`.
    expect(flat('a + (b + c) = 0')).toEqual({
      operandPaths: ['lhs/0', 'lhs/1/0', 'lhs/1/1'],
      linkPaths: ['lhs/1'],
    });
  });

  it('degenerates to a single operand when the root is not an operator', () => {
    // A bare symbol root has nothing to flatten.
    expect(flat('a = 0')).toEqual({ operandPaths: ['lhs'], linkPaths: [] });
  });

  it('leaves a meaningful paren as a single operand (no flatten across it)', () => {
    // `a*(b+c)` root `*` — the parenthesised sum is one operand, not descended into.
    expect(flat('a * (b + c) = 0')).toEqual({
      operandPaths: ['lhs/0', 'lhs/1'],
      linkPaths: [],
    });
  });
});
