import * as math from 'mathjs';
import { parseEquation } from '../src/index';
import { canonicalizeAssociativeChains, ensureNodeIds, Equation } from '../src/tree';

// Structural skeleton ignoring ids — captures the *nesting* of a tree.
const skeleton = (n: any): string => {
  if (n.type === 'OperatorNode') return `${n.op}(${n.args.map(skeleton).join(',')})`;
  if (n.type === 'FunctionNode') return `${n.fn?.name ?? n.name}(${n.args.map(skeleton).join(',')})`;
  if (n.type === 'ParenthesisNode') return `(${skeleton(n.content)})`;
  return n.name ?? String(n.value);
};

const sym = (name: string): math.MathNode => new (math as any).SymbolNode(name);
const mul = (a: math.MathNode, b: math.MathNode): math.MathNode =>
  new (math as any).OperatorNode('*', 'multiply', [a, b]);

describe('canonicalizeAssociativeChains (#378)', () => {
  test('rewrites a right-nested product into the parser-canonical left-nested shape', () => {
    // b*(c*a) — the shape a transposition move emits — must become (b*c)*a.
    const rightNested = mul(sym('b'), mul(sym('c'), sym('a')));
    const eq: Equation = { lhs: sym('x'), rhs: rightNested, relation: '=' };

    const out = canonicalizeAssociativeChains(eq);
    expect(skeleton(out.rhs)).toBe('*(*(b,c),a)');
    expect(skeleton(out.rhs)).toBe(skeleton(parseEquation('x = b * c * a').rhs));
  });

  test('preserves operand ids while re-nesting', () => {
    const b = sym('b');
    const c = sym('c');
    const a = sym('a');
    (b as any).id = 'id-b';
    (c as any).id = 'id-c';
    (a as any).id = 'id-a';
    const eq: Equation = { lhs: sym('x'), rhs: mul(b, mul(c, a)), relation: '=' };

    const out = canonicalizeAssociativeChains(eq) as any;
    // (b*c)*a — operand leaves keep their original ids after re-nesting.
    expect(out.rhs.args[0].args[0].id).toBe('id-b');
    expect(out.rhs.args[0].args[1].id).toBe('id-c');
    expect(out.rhs.args[1].id).toBe('id-a');
  });

  test('is a structural no-op on an already-canonical chain', () => {
    const eq = parseEquation('x = a + b + c + d');
    const before = skeleton(eq.rhs);
    const out = canonicalizeAssociativeChains(eq);
    expect(skeleton(out.rhs)).toBe(before);
    expect(before).toBe('+(+(+(a,b),c),d)');
  });

  test('preserves precedence and explicit grouping', () => {
    // a + b*c stays whole (different op); (a + b) + c keeps the parenthesised sum.
    const eq1 = parseEquation('y = a + b * c');
    expect(skeleton(canonicalizeAssociativeChains(eq1).rhs)).toBe(skeleton(eq1.rhs));

    const eq2 = parseEquation('y = (a + b) + c');
    expect(skeleton(canonicalizeAssociativeChains(eq2).rhs)).toBe(skeleton(eq2.rhs));
  });

  test('ensureNodeIds backfills the id on a freshly created link node', () => {
    // The inner wrapper of a move-built right-nested pair has no id; after
    // canonicalize + ensureNodeIds every node carries one.
    const eq: Equation = { lhs: sym('x'), rhs: mul(sym('b'), mul(sym('c'), sym('a'))), relation: '=' };
    const out = ensureNodeIds(canonicalizeAssociativeChains(eq));
    const ids: (string | undefined)[] = [];
    const walk = (n: any): void => {
      ids.push(n.id);
      (n.args ?? []).forEach(walk);
      if (n.content) walk(n.content);
    };
    walk(out.lhs);
    walk(out.rhs);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });
});
