// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  savedSessionsAtom,
  rawTabsAtom,
  rawActiveTabIdAtom,
  loadSessionAtom,
  resetToEquationStringAtom,
  treeRefocusNonceAtom,
  serializeTree,
  type SavedSession,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeSession(id: string): SavedSession {
  const tree = serializeTree({
    '0': { id: '0', equation: parseEquation('x^2-9=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  });
  return { id, name: `session ${id}`, timestamp: 1, tree, currentNodeId: '0' };
}

const emptyTab = (id: string): WorkspaceTab => ({
  id,
  name: 'scratch',
  historyTree: {
    '0': { id: '0', equation: parseEquation('x=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  isCustomNamed: true,
  timestamp: 1,
});

describe('loadSessionAtom — keyboard refocus on library load (#231)', () => {
  it('requests a tree refocus when loading a saved session into a new tab', () => {
    const store = createStore();
    store.set(rawTabsAtom, [emptyTab('scratch')]);
    store.set(rawActiveTabIdAtom, 'scratch');
    store.set(savedSessionsAtom, [makeSession('lib-1')]);

    const before = store.get(treeRefocusNonceAtom);
    store.set(loadSessionAtom, 'lib-1');
    expect(store.get(treeRefocusNonceAtom)).toBe(before + 1);
  });

  it('also refocuses when the library session is already open in a tab', () => {
    const store = createStore();
    const existing: WorkspaceTab = { ...emptyTab('open'), sessionId: 'lib-1' };
    store.set(rawTabsAtom, [existing]);
    store.set(rawActiveTabIdAtom, 'open');
    store.set(savedSessionsAtom, [makeSession('lib-1')]);

    const before = store.get(treeRefocusNonceAtom);
    store.set(loadSessionAtom, 'lib-1');
    expect(store.get(treeRefocusNonceAtom)).toBe(before + 1);
  });

  it('requests a refocus when loading an equation from the library / input modal (resetToEquationString)', () => {
    const store = createStore();
    store.set(rawTabsAtom, [emptyTab('scratch')]);
    store.set(rawActiveTabIdAtom, 'scratch');

    const before = store.get(treeRefocusNonceAtom);
    store.set(resetToEquationStringAtom, 'x^2-9=0');
    expect(store.get(treeRefocusNonceAtom)).toBe(before + 1);
  });
});
