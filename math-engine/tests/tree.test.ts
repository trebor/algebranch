import * as math from 'mathjs';
import { parseEquation, getReducibleOptions } from '../src/index';
import { canonicalizeAssociativeChains, ensureNodeIds, getChildren, removeNodeAtPath, Equation } from '../src/tree';

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

describe('removeNodeAtPath — head-of-subtraction sign (#354)', () => {
  test('removing the head of a subtraction leaves the negated remainder', () => {
    // `a - b` with `a` removed is `-b`, not `b` — the leading minus that binds the
    // remaining term to its side must survive, or no operator on the other side
    // can reconstruct an equivalent equation (so the head drops out of the
    // movable set). See #354.
    const eq = parseEquation('a - b = 0');
    const { newEquation, removedNode } = removeNodeAtPath(eq, 'lhs/0');
    expect(skeleton(removedNode)).toBe('a');
    expect(skeleton(newEquation.lhs)).toBe('-(b)');
  });

  test('removing a non-head subtrahend is unchanged (a - b, remove b -> a)', () => {
    const eq = parseEquation('a - b = 0');
    const { newEquation, removedNode } = removeNodeAtPath(eq, 'lhs/1');
    expect(skeleton(removedNode)).toBe('b');
    expect(skeleton(newEquation.lhs)).toBe('a');
  });

  test('removing the head of an addition is unchanged (a + b, remove a -> b)', () => {
    const eq = parseEquation('a + b = 0');
    const { newEquation } = removeNodeAtPath(eq, 'lhs/0');
    expect(skeleton(newEquation.lhs)).toBe('b');
  });
});

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

describe('ensureNodeIds — de-aliases shared node objects (#400)', () => {
  // Collects every node object across both sides of an equation.
  const collectNodes = (eq: Equation): math.MathNode[] => {
    const nodes: math.MathNode[] = [];
    const walk = (n: math.MathNode) => {
      if (!n) return;
      nodes.push(n);
      getChildren(n).forEach(walk);
    };
    walk(eq.lhs);
    walk(eq.rhs);
    return nodes;
  };

  // Every tree position must be a distinct object with a distinct id.
  const expectNoAliasing = (eq: Equation) => {
    const nodes = collectNodes(eq);
    const ids = nodes.map((n) => (n as unknown as { id?: string }).id);
    expect(new Set(nodes).size).toBe(nodes.length); // no shared object references
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
  };

  const findOption = (input: string, label: string): Equation => {
    const option = Object.values(getReducibleOptions(parseEquation(input)))
      .flat()
      .find((o) => o.label === label);
    if (!option) throw new Error(`No reduction "${label}" found for ${input}`);
    return option.simplified;
  };

  test('Quadratic Formula (−) output has no aliased nodes', () => {
    const simplified = findOption('x^2-4x=0', 'Apply Quadratic Formula (-)');
    expectNoAliasing(ensureNodeIds(simplified));
  });

  test('Distribute output has no aliased nodes', () => {
    const simplified = findOption('2*(x+3)=10', 'Distribute');
    expectNoAliasing(ensureNodeIds(simplified));
  });

  test('an already alias-free tree round-trips structurally unchanged', () => {
    const eq = ensureNodeIds(parseEquation('a + b * c = d'));
    const before = { lhs: eq.lhs.toString(), rhs: eq.rhs.toString() };
    const out = ensureNodeIds(eq);
    expectNoAliasing(out);
    expect({ lhs: out.lhs.toString(), rhs: out.rhs.toString() }).toEqual(before);
    // Stable ids survive an id-clean pass unchanged.
    expect((out.lhs as unknown as { id: string }).id).toBe((eq.lhs as unknown as { id: string }).id);
  });

  // Regression: `√(181−b²)·√(181−b²)·√(181−b²)+b³=1729`, once combined and then
  // expanded, produced a reduction preview whose `ensureNodeIds` output still held
  // duplicate ids (`node_4dmn0a_5` twice), tripping React's "same key" render error.
  // Root cause: the generator handed out `node_<prefix>_<counter>` without checking
  // `seenIds`, so a preserved id sharing the current prefix could be re-minted for a
  // de-aliased node. Walking the real reduction graph exercises the exact trigger.
  test('reduction previews down a real transform chain keep every id unique (#462)', () => {
    let eq = ensureNodeIds(parseEquation('sqrt(181 - b^2) * sqrt(181 - b^2) * sqrt(181 - b^2) + b^3 = 1729'));
    for (let step = 0; step < 4; step++) {
      const options = Object.values(getReducibleOptions(eq)).flat();
      if (options.length === 0) break;
      // Every option is rendered as a preview (via ensureNodeIds) — none may alias.
      for (const option of options) {
        expectNoAliasing(ensureNodeIds(option.simplified));
      }
      // Advance the chain by committing the first option, exactly as the store does.
      eq = ensureNodeIds(options[0].simplified);
      expectNoAliasing(eq);
    }
  });
});
