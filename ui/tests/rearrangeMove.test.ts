// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  pushEquationAtom,
  sourcePathAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  minifyWorkspace,
  deminifyWorkspace,
  serializeTree,
  type WorkspaceTab,
  type SerializedHistoryNode,
} from '@/store/equation';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { describeSameSideMove, type StepChange } from 'math-engine';

function makeStore(eqText: string) {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: ensureNodeIds(parseEquation(eqText)), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

/** The label the newly-pushed child node was created with. */
function pushedLabel(store: ReturnType<typeof createStore>): string {
  const tree = store.get(historyTreeAtom);
  const current = store.get(currentNodeIdAtom);
  return tree[current].label;
}

describe('pushEquationAtom — drag-move label fallback (#512)', () => {
  it('a same-side rearrange change labels the step "Rearrange", not "Move"', () => {
    // 3/4 + 1/2 = x → (3 - 2)/4 + 1 = x is a valid within-a-side move (#512).
    const before = ensureNodeIds(parseEquation('3/4 + 1/2 = x'));
    const resultEq = ensureNodeIds(parseEquation('(3 - 2)/4 + 1 = x'));
    const change = describeSameSideMove(before, resultEq, 'lhs/1/1');
    expect(change).toMatchObject({ kind: 'rewrite', label: 'Rearrange' });

    const store = makeStore('3/4 + 1/2 = x');
    store.set(sourcePathAtom, 'lhs/1/1'); // a drag is in flight
    store.set(pushEquationAtom, resultEq, undefined, change ?? undefined);
    expect(pushedLabel(store)).toBe('Rearrange');
  });

  it('"Move" survives only as the last-resort label for an undescribed drag', () => {
    const store = makeStore('3/4 + 1/2 = x');
    store.set(sourcePathAtom, 'lhs/1/1'); // a drag with no structured change
    store.set(pushEquationAtom, ensureNodeIds(parseEquation('(3 - 2)/4 + 1 = x')), undefined, undefined);
    expect(pushedLabel(store)).toBe('Move');
  });
});

describe('rearrange change survives the share-link round-trip (#512)', () => {
  it('deminify(minify(tree)) preserves the rearrange StepChange structurally', () => {
    const change: StepChange = {
      kind: 'rewrite',
      family: 'rearrange',
      op: 'rearrange',
      detail: '3 / 4 + 1 / 2 → (3 - 2) / 4 + 1',
      label: 'Rearrange',
      text: 'rearrange 3 / 4 + 1 / 2 into (3 - 2) / 4 + 1',
    };
    const tree: Record<string, SerializedHistoryNode> = serializeTree({
      '0': { id: '0', equation: ensureNodeIds(parseEquation('3/4 + 1/2 = x')), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: ensureNodeIds(parseEquation('(3 - 2)/4 + 1 = x')), parentId: '0', childrenIds: [], label: 'Rearrange', timestamp: 2, change },
    });

    const restored = deminifyWorkspace(minifyWorkspace({ tree, currentNodeId: '1', name: 'w' }));
    const restoredChild = Object.values(restored.tree).find((n) => n.label === 'Rearrange');
    expect(restoredChild?.change).toEqual(change);
  });

  it('an old link with a bare "Move" label and no change still loads', () => {
    const tree: Record<string, SerializedHistoryNode> = serializeTree({
      '0': { id: '0', equation: ensureNodeIds(parseEquation('3/4 + 1/2 = x')), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: ensureNodeIds(parseEquation('(3 - 2)/4 + 1 = x')), parentId: '0', childrenIds: [], label: 'Move', timestamp: 2 },
    });
    const restored = deminifyWorkspace(minifyWorkspace({ tree, currentNodeId: '1', name: 'w' }));
    const restoredChild = Object.values(restored.tree).find((n) => n.label === 'Move');
    expect(restoredChild).toBeDefined();
    expect(restoredChild?.change).toBeUndefined();
  });
});
