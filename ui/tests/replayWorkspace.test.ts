// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Replay encoding for `?ws=` share links (#403, Track 1). Instead of storing each
// derivation node's full equation, store the *operation* that produced it from its
// parent and re-run the engine on load. These tests build trees with the SAME real
// engine transforms the store uses (applyGlobalOp / getReducibleOptions / swap), then
// assert the replay codec round-trips every node exactly, re-derives term ids (FLIP),
// falls back to embedded state for anything unreproducible, flags drift, and stays small.
import { describe, it, expect } from 'vitest';
import {
  serializeTree,
  deserializeTree,
  minifyReplayWorkspace,
  deminifyReplayWorkspace,
  WS_REPLAY_VERSION,
  type HistoryNode,
} from '@/store/equation';
import {
  parseEquation,
  ensureNodeIds,
  equationToString,
  applyGlobalOp,
  getReducibleOptions,
  flipRelation,
  describeGlobalOp,
} from 'math-engine';
import type * as math from 'mathjs';

let idc = 0;
const nid = () => `step_${++idc}`;

/** Append a child to `tree[parentId]` carrying `equation` + `change`, return its id. */
const addChild = (
  tree: Record<string, HistoryNode>,
  parentId: string,
  equation: math.MathNode extends never ? never : import('math-engine').Equation,
  label: string,
  change?: import('math-engine').StepChange,
): string => {
  const id = nid();
  tree[id] = { id, equation, parentId, childrenIds: [], label, timestamp: idc, change };
  tree[parentId].childrenIds.push(id);
  return id;
};

/** Root single-node tree for `eqStr`. */
const rootTree = (eqStr: string): Record<string, HistoryNode> => ({
  '0': { id: '0', equation: ensureNodeIds(parseEquation(eqStr)), parentId: null, childrenIds: [], label: 'Initial', timestamp: 0 },
});

/** first id of the SymbolNode named `name` in preorder (for FLIP id checks). */
const symbolId = (eq: { lhs: math.MathNode; rhs: math.MathNode }, name: string): string | undefined => {
  const visit = (node: math.MathNode | undefined): string | undefined => {
    if (!node) return undefined;
    const n = node as unknown as Record<string, unknown>;
    if (n.type === 'SymbolNode' && n.name === name) return n.id as string | undefined;
    const kids = (n.args as math.MathNode[] | undefined) ?? (n.content ? [n.content as math.MathNode] : []);
    for (const k of kids) { const f = visit(k); if (f) return f; }
    return undefined;
  };
  return visit(eq.lhs) ?? visit(eq.rhs);
};

/** Apply a global op to the current node exactly as the store does, add the child. */
const globalStep = (tree: Record<string, HistoryNode>, fromId: string, params: import('math-engine').GlobalOpParams, label: string): string => {
  const next = ensureNodeIds(applyGlobalOp(tree[fromId].equation, params));
  return addChild(tree, fromId, next, label, describeGlobalOp(params));
};

/** Apply the first reduction option at any path, mirroring the reduce stack. */
const reduceStep = (tree: Record<string, HistoryNode>, fromId: string, label = 'Simplify'): string | null => {
  const opts = getReducibleOptions(tree[fromId].equation);
  const firstPath = Object.keys(opts)[0];
  if (!firstPath) return null;
  const opt = opts[firstPath][0];
  return addChild(tree, fromId, ensureNodeIds(opt.simplified), opt.label || label, { kind: 'rewrite', op: opt.type === 'distribute' ? 'distribute' : 'simplify', text: 'simplify' });
};

/** Round-trip a live tree through the replay codec and return the rebuilt live tree + drift. */
const roundTrip = (tree: Record<string, HistoryNode>, currentNodeId: string, name: string) => {
  const min = minifyReplayWorkspace({ tree: serializeTree(tree), currentNodeId, name });
  const de = deminifyReplayWorkspace(min);
  return { min, de, rebuilt: deserializeTree(de.tree), payloadLen: JSON.stringify(min).length };
};

/** Assert two live trees carry the same equations + structure (ids re-mapped). */
const expectSameTree = (a: Record<string, HistoryNode>, b: Record<string, HistoryNode>) => {
  expect(Object.keys(b).length).toBe(Object.keys(a).length);
  const byEq = (t: Record<string, HistoryNode>) =>
    Object.values(t).map(n => equationToString(n.equation)).sort();
  expect(byEq(b)).toEqual(byEq(a));
};

describe('replay workspace codec (#403)', () => {
  it('round-trips a linear-solve tree of global ops + a reduction', () => {
    const tree = rootTree('2 * x + 3 = 10');
    const a = globalStep(tree, '0', { type: 'sub', term: '3' }, 'Global - 3');
    const b = reduceStep(tree, a) ?? a; // 3-3 -> 0, 10-3 -> 7 etc.
    const c = globalStep(tree, b, { type: 'div', term: '2' }, 'Global ÷ 2');

    const { min, de, rebuilt } = roundTrip(tree, c, 'Linear');
    expect(min.v).toBe(WS_REPLAY_VERSION);
    expect(de.drift).toBe(false);
    expect(de.name).toBe('Linear');
    expectSameTree(tree, rebuilt);
    // currentNode equation preserved
    expect(equationToString(rebuilt[de.currentNodeId].equation)).toBe(equationToString(tree[c].equation));
  });

  it('re-derives shared term ids across a step (FLIP continuity)', () => {
    const tree = rootTree('2 * x = 4');
    const a = globalStep(tree, '0', { type: 'div', term: '2' }, 'Global ÷ 2');
    const { rebuilt, de } = roundTrip(tree, a, 'flip');
    // In the rebuilt tree, x should carry ONE id across root and child.
    const rootNode = Object.values(rebuilt).find(n => n.parentId === null)!;
    const childNode = rebuilt[de.currentNodeId];
    const rootX = symbolId(rootNode.equation, 'x');
    const childX = symbolId(childNode.equation, 'x');
    expect(rootX).toBeDefined();
    expect(rootX).toBe(childX);
  });

  it('handles a branching tree (two children off one node)', () => {
    const tree = rootTree('x + 1 = 5');
    const a = globalStep(tree, '0', { type: 'sub', term: '1' }, 'Global - 1');
    const b = globalStep(tree, '0', { type: 'add', term: '2' }, 'Global + 2');
    const { rebuilt, de } = roundTrip(tree, a, 'branch');
    expect(de.drift).toBe(false);
    expectSameTree(tree, rebuilt);
    // root has two children in the rebuilt tree
    const root = Object.values(rebuilt).find(n => n.parentId === null)!;
    expect(root.childrenIds.length).toBe(2);
    void b;
  });

  it('falls back to embedded state for an unreproducible node, still exact', () => {
    // A node whose `change` claims a global op that does NOT produce its equation:
    // the encoder must verify, reject the replay, and embed the exact state.
    const tree = rootTree('x = 1');
    const bogus = ensureNodeIds(parseEquation('x = 999'));
    addChild(tree, '0', bogus, 'Mystery', { kind: 'bothSides', op: 'add', operand: '1', text: 'add 1 to both sides' });
    const cur = tree['0'].childrenIds[0];
    const { rebuilt, de } = roundTrip(tree, cur, 'fallback');
    expect(de.drift).toBe(false);
    // exact reconstruction despite the misleading change
    expect(equationToString(rebuilt[de.currentNodeId].equation)).toBe('x = 999');
  });

  it('flags drift when a per-node checksum does not match on decode', () => {
    const tree = rootTree('2 * x = 4');
    const a = globalStep(tree, '0', { type: 'div', term: '2' }, 'Global ÷ 2');
    const min = minifyReplayWorkspace({ tree: serializeTree(tree), currentNodeId: a, name: 'drift' });
    // Corrupt the child record's checksum (last element of a non-root replay record).
    const childRec = min.r[1] as unknown[];
    childRec[childRec.length - 1] = '!!';
    const de = deminifyReplayWorkspace(min);
    expect(de.drift).toBe(true);
    // still loads a tree
    expect(Object.keys(de.tree).length).toBe(2);
  });

  it('encodes a deep multi-step tree well under the ~2000-char link floor', () => {
    // A bounded linear derivation: alternate a global op with a constant-folding
    // reduce so equations stay small while the tree grows ~20+ nodes deep.
    const tree = rootTree('3 * x + 6 = 3 * x + 6');
    let cur = '0';
    for (let i = 0; i < 11; i++) {
      cur = globalStep(tree, cur, { type: 'add', term: String(i + 1) }, `Global + ${i + 1}`);
      const r = reduceStep(tree, cur);
      if (r) cur = r;
    }
    const { min, payloadLen } = roundTrip(tree, cur, 'big');
    expect(Object.keys(tree).length).toBeGreaterThanOrEqual(20);
    // Raw JSON payload before deflate+base64url; the shared link is far smaller.
    // Even uncompressed this must sit well under the ~2000-char interop floor.
    expect(payloadLen).toBeLessThan(2000);
    // Sanity: no node ballooned to an embedded fallback unexpectedly.
    const embedded = min.r.filter(rec => (rec as unknown[])[1] === 'e').length;
    expect(embedded).toBe(0);
  }, 20000);

  it('round-trips swap sides (no change recorded)', () => {
    const tree = rootTree('x + 2 = y');
    const swapped = ensureNodeIds({ lhs: tree['0'].equation.rhs, rhs: tree['0'].equation.lhs, relation: flipRelation(tree['0'].equation.relation) });
    addChild(tree, '0', swapped, 'Swap Sides');
    const cur = tree['0'].childrenIds[0];
    const { rebuilt, de } = roundTrip(tree, cur, 'swap');
    expect(de.drift).toBe(false);
    expect(equationToString(rebuilt[de.currentNodeId].equation)).toBe(equationToString(swapped));
  });
});
