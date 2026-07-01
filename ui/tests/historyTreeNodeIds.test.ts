// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// History-tree persistence must preserve math-engine node ids across the whole
// tree (#344). The FLIP slide (#234) matches a surviving term across an equation
// change by its node id (`data-flip-id`); for the slide to survive a reload
// (localStorage restore or a `?ws=` share link), the *same logical term* must
// keep the *same id* on both sides of every step. The legacy string serializer
// discarded ids and re-hashed each node independently on load, so the same term
// got different ids per node → zero id matches → nodes snapped instead of slid.
import { describe, it, expect } from 'vitest';
import {
  serializeTree,
  deserializeTree,
  minifyWorkspace,
  deminifyWorkspace,
  STORAGE_SCHEMA_VERSION,
  type HistoryNode,
  type SerializedHistoryNode,
} from '@/store/equation';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { applyGlobalOp } from 'math-engine';
import type * as math from 'mathjs';

/** First id of a SymbolNode named `name` found in preorder, or undefined. */
const symbolId = (eq: { lhs: math.MathNode; rhs: math.MathNode }, name: string): string | undefined => {
  const visit = (node: math.MathNode | undefined): string | undefined => {
    if (!node) return undefined;
    const n = node as unknown as Record<string, unknown>;
    if (n.type === 'SymbolNode' && n.name === name) return n.id as string | undefined;
    const kids = (n.args as math.MathNode[] | undefined) ?? (n.content ? [n.content as math.MathNode] : []);
    for (const k of kids) {
      const found = visit(k);
      if (found) return found;
    }
    return undefined;
  };
  return visit(eq.lhs) ?? visit(eq.rhs);
};

/**
 * A two-node history tree mirroring the live engine: `applyGlobalOp` reuses the
 * parent's surviving subtrees (so `x` keeps its node reference/id), then
 * `ensureNodeIds` fills only the freshly created nodes — exactly what the store
 * does at equation.ts. The surviving `x` therefore shares one id across both nodes.
 */
const liveTree = (): { tree: Record<string, HistoryNode>; xId: string } => {
  const parent = ensureNodeIds(parseEquation('2*x = 4'));
  const child = ensureNodeIds(applyGlobalOp(parent, { type: 'div', term: '2' }));

  const xParent = symbolId(parent, 'x');
  const xChild = symbolId(child, 'x');
  // Precondition: the live tree already shares the id across nodes.
  expect(xParent).toBeDefined();
  expect(xChild).toBe(xParent);

  const tree: Record<string, HistoryNode> = {
    '0': { id: '0', equation: parent, parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
    '1': { id: '1', equation: child, parentId: '0', childrenIds: [], label: 'Divide by 2', timestamp: 2 },
  };
  return { tree, xId: xParent! };
};

describe('history-tree persistence preserves node ids across the tree (#344)', () => {
  it('keeps a surviving term’s id identical across parent and child after a serialize round-trip', () => {
    const { tree, xId } = liveTree();

    const restored = deserializeTree(serializeTree(tree));

    const xParent = symbolId(restored['0'].equation, 'x');
    const xChild = symbolId(restored['1'].equation, 'x');

    // The FLIP-critical property: the same logical term keeps one id across nodes.
    expect(xParent).toBe(xId);
    expect(xChild).toBe(xId);
    expect(xChild).toBe(xParent);
  });

  it('preserves cross-node id continuity through a `?ws=` minify/deminify round-trip', () => {
    const { tree } = liveTree();

    const minified = minifyWorkspace({ tree: serializeTree(tree), currentNodeId: '1', name: 'Test' });
    const deminified = deminifyWorkspace(minified);
    const restored = deserializeTree(deminified.tree);

    const nodes = Object.values(restored);
    const parentNode = nodes.find((n) => n.parentId === null)!;
    const childNode = nodes.find((n) => n.parentId === parentNode.id)!;

    const xParent = symbolId(parentNode.equation, 'x');
    const xChild = symbolId(childNode.equation, 'x');
    expect(xParent).toBeDefined();
    expect(xChild).toBe(xParent);
  });

  it('bumps the persisted schema version (old clients must reject the new equation format)', () => {
    // The equation encoding changed from a plain string to an id-bearing AST; a
    // version bump lets an older client cleanly reject a payload it can't parse.
    expect(STORAGE_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });
});

describe('back-compat: legacy string-format history still loads (#344)', () => {
  it('deserializes a legacy string-equation node without crashing', () => {
    const legacy: Record<string, SerializedHistoryNode> = {
      '0': { id: '0', equation: '2 * (x + 3) = 10', parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    };

    const restored = deserializeTree(legacy);

    expect(restored['0'].equation).toBeDefined();
    // Round-trips to a real equation (ids assigned by the legacy parse path).
    expect(symbolId(restored['0'].equation, 'x')).toBeDefined();
  });
});
