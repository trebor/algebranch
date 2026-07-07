// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Path-only share (#439): a share-time scope choice between the whole workspace
// tree (today's behavior, default) and just the root → current-node lineage,
// replay-encoded as a plain linear chain. The lineage filter runs BEFORE
// minifyReplayWorkspace, so the emitted payload format is unchanged — recipients'
// decode path needs zero changes and old links are unaffected.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';

// jsdom's Blob lacks `.stream()`, which the engine's share (de)compression relies
// on. Swap in Node's Blob (with CompressionStream, a Node 18+ global) for this file.
let originalBlob: typeof globalThis.Blob;
beforeAll(() => {
  originalBlob = globalThis.Blob;
  globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
});
afterAll(() => {
  globalThis.Blob = originalBlob;
});

import {
  serializeTree,
  deserializeTree,
  minifyReplayWorkspace,
  deminifyReplayWorkspace,
  filterTreeToPath,
  serializeWorkspaceState,
  type HistoryNode,
} from '@/store/equation';
import {
  parseEquation,
  ensureNodeIds,
  equationToString,
  applyGlobalOp,
  describeGlobalOp,
  type GlobalOpParams,
} from 'math-engine';
import { decompressString } from 'math-engine-client';

let idc = 0;
const nid = () => `step_${++idc}`;

/** Root single-node tree for `eqStr`. */
const rootTree = (eqStr: string): Record<string, HistoryNode> => ({
  '0': { id: '0', equation: ensureNodeIds(parseEquation(eqStr)), parentId: null, childrenIds: [], label: 'Initial', timestamp: 0 },
});

/** Apply a global op to `fromId` exactly as the store does, add the child. */
const globalStep = (tree: Record<string, HistoryNode>, fromId: string, params: GlobalOpParams, label: string): string => {
  const id = nid();
  const next = ensureNodeIds(applyGlobalOp(tree[fromId].equation, params));
  tree[id] = { id, equation: next, parentId: fromId, childrenIds: [], label, timestamp: ++idc, change: describeGlobalOp(params) };
  tree[fromId].childrenIds.push(id);
  return id;
};

/**
 * A branching workspace: a two-step winning path off the root plus two abandoned
 * branches (one off the root, one off the first path step).
 *   0 ── a ── b        (winning path, `b` current)
 *   ├── dead1
 *   a └── dead2
 */
const branchingTree = () => {
  const tree = rootTree('2 * x + 3 = 10');
  const a = globalStep(tree, '0', { type: 'sub', term: '3' }, 'Global - 3');
  const dead1 = globalStep(tree, '0', { type: 'add', term: '7' }, 'Global + 7');
  const dead2 = globalStep(tree, a, { type: 'mul', term: '5' }, 'Global * 5');
  const b = globalStep(tree, a, { type: 'div', term: '2' }, 'Global ÷ 2');
  return { tree, path: ['0', a, b], dead: [dead1, dead2], current: b };
};

describe('path-only share (#439)', () => {
  describe('filterTreeToPath', () => {
    it('keeps only the root → current chain, childrenIds pruned to the chain', () => {
      const { tree, path, current } = branchingTree();
      const filtered = filterTreeToPath(serializeTree(tree), current);

      expect(Object.keys(filtered).sort()).toEqual([...path].sort());
      // Each chain node points only at the next chain node; the leaf has none.
      for (let i = 0; i < path.length; i++) {
        const expected = i + 1 < path.length ? [path[i + 1]] : [];
        expect(filtered[path[i]].childrenIds).toEqual(expected);
      }
    });

    it('does not mutate the input tree', () => {
      const { tree, current } = branchingTree();
      const serialized = serializeTree(tree);
      const rootChildrenBefore = [...serialized['0'].childrenIds];
      filterTreeToPath(serialized, current);
      expect(serialized['0'].childrenIds).toEqual(rootChildrenBefore);
    });

    it('root-selected: filters a branching tree down to just the root', () => {
      const { tree } = branchingTree();
      const filtered = filterTreeToPath(serializeTree(tree), '0');
      expect(Object.keys(filtered)).toEqual(['0']);
      expect(filtered['0'].childrenIds).toEqual([]);
    });
  });

  describe('path payload via the replay codec', () => {
    it('decodes to a linear tree with the current node as the leaf', () => {
      const { tree, path, current } = branchingTree();
      const min = minifyReplayWorkspace({
        tree: filterTreeToPath(serializeTree(tree), current),
        currentNodeId: current,
        name: 'Path',
      });
      const de = deminifyReplayWorkspace(min);
      const rebuilt = deserializeTree(de.tree);

      expect(de.drift).toBe(false);
      expect(de.name).toBe('Path');
      expect(Object.keys(rebuilt)).toHaveLength(path.length);
      // Linear: every node has at most one child; the current node is the leaf.
      for (const node of Object.values(rebuilt)) {
        expect(node.childrenIds.length).toBeLessThanOrEqual(1);
      }
      expect(rebuilt[de.currentNodeId].childrenIds).toEqual([]);
      expect(equationToString(rebuilt[de.currentNodeId].equation))
        .toBe(equationToString(tree[current].equation));
    });

    it('branch nodes are absent from the payload', () => {
      const { tree, dead, current } = branchingTree();
      const min = minifyReplayWorkspace({
        tree: filterTreeToPath(serializeTree(tree), current),
        currentNodeId: current,
        name: 'Path',
      });
      const de = deminifyReplayWorkspace(min);
      const rebuiltEqs = Object.values(deserializeTree(de.tree)).map(n => equationToString(n.equation));
      for (const deadId of dead) {
        expect(rebuiltEqs).not.toContain(equationToString(tree[deadId].equation));
      }
    });
  });

  describe('serializeWorkspaceState scope param', () => {
    it("default and explicit 'full' are byte-identical to today's whole-tree payload", async () => {
      const { tree, current } = branchingTree();
      const byDefault = await serializeWorkspaceState(tree, current, 'Work');
      const byFull = await serializeWorkspaceState(tree, current, 'Work', 'full');
      expect(byFull).toBe(byDefault);
      // Today's payload: the whole tree minified, unfiltered.
      const legacy = JSON.stringify(
        minifyReplayWorkspace({ tree: serializeTree(tree), currentNodeId: current, name: 'Work' }),
      );
      expect(await decompressString(byDefault)).toBe(legacy);
    });

    it("'path' emits only the lineage — fewer records, name preserved, current is the leaf", async () => {
      const { tree, path, current } = branchingTree();
      const compressed = await serializeWorkspaceState(tree, current, 'Work', 'path');
      const payload = JSON.parse(await decompressString(compressed));
      expect(payload.r).toHaveLength(path.length);
      const de = deminifyReplayWorkspace(payload);
      expect(de.name).toBe('Work');
      expect(de.drift).toBe(false);
      expect(de.tree[de.currentNodeId].childrenIds).toEqual([]);
    });

    it('single-node workspace: path scope round-trips the lone root', async () => {
      const tree = rootTree('x + 1 = 5');
      const compressed = await serializeWorkspaceState(tree, '0', 'Solo', 'path');
      const de = deminifyReplayWorkspace(JSON.parse(await decompressString(compressed)));
      expect(Object.keys(de.tree)).toHaveLength(1);
      expect(de.name).toBe('Solo');
      const rebuilt = deserializeTree(de.tree);
      expect(equationToString(rebuilt[de.currentNodeId].equation)).toBe(equationToString(tree['0'].equation));
    });

    it('root-selected in a branching tree: path scope shares just the root node', async () => {
      const { tree } = branchingTree();
      const compressed = await serializeWorkspaceState(tree, '0', 'Rooted', 'path');
      const payload = JSON.parse(await decompressString(compressed));
      expect(payload.r).toHaveLength(1);
      const de = deminifyReplayWorkspace(payload);
      const rebuilt = deserializeTree(de.tree);
      expect(equationToString(rebuilt[de.currentNodeId].equation)).toBe(equationToString(tree['0'].equation));
    });
  });
});
