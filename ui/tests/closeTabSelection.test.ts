// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  activeTabIdAtom,
  closeTabAtom,
  deleteSessionAtom,
  savedSessionsAtom,
  serializeTree,
  type WorkspaceTab,
  type SavedSession,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

const tab = (id: string, sessionId?: string): WorkspaceTab => ({
  id,
  name: id,
  historyTree: {
    '0': { id: '0', equation: parseEquation('x=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  isCustomNamed: true,
  timestamp: 1,
  ...(sessionId ? { sessionId } : {}),
});

const makeSession = (id: string): SavedSession => ({
  id,
  name: `session ${id}`,
  timestamp: 1,
  tree: serializeTree({
    '0': { id: '0', equation: parseEquation('x=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  }),
  currentNodeId: '0',
});

describe('closeTabAtom — Chrome-like next-tab selection (#449)', () => {
  it('activates the right neighbor when closing the active tab, not the first tab', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tab('a'), tab('b'), tab('c'), tab('d')]);
    store.set(rawActiveTabIdAtom, 'c');

    store.set(closeTabAtom, 'c');

    expect(store.get(activeTabIdAtom)).toBe('d');
  });

  it('falls back to the new rightmost when closing the rightmost active tab', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tab('a'), tab('b'), tab('c')]);
    store.set(rawActiveTabIdAtom, 'c');

    store.set(closeTabAtom, 'c');

    expect(store.get(activeTabIdAtom)).toBe('b');
  });

  it('leaves the active tab unchanged when closing a different (non-active) tab', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tab('a'), tab('b'), tab('c')]);
    store.set(rawActiveTabIdAtom, 'b');

    store.set(closeTabAtom, 'a');

    expect(store.get(activeTabIdAtom)).toBe('b');
  });

  it('lets you rapidly close a run from the middle without jumping to the first tab', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tab('a'), tab('b'), tab('c'), tab('d'), tab('e')]);
    store.set(rawActiveTabIdAtom, 'c');

    store.set(closeTabAtom, 'c');
    expect(store.get(activeTabIdAtom)).toBe('d');
    store.set(closeTabAtom, 'd');
    expect(store.get(activeTabIdAtom)).toBe('e');
    store.set(closeTabAtom, 'e'); // rightmost now — fall back to new rightmost
    expect(store.get(activeTabIdAtom)).toBe('b');
  });
});

describe('deleteSessionAtom — next-tab selection matches closeTab (#449)', () => {
  it('activates the right neighbor when deleting the active session', () => {
    const store = createStore();
    store.set(rawTabsAtom, [tab('a', 'sa'), tab('b', 'sb'), tab('c', 'sc')]);
    store.set(rawActiveTabIdAtom, 'b');
    store.set(savedSessionsAtom, [makeSession('sa'), makeSession('sb'), makeSession('sc')]);

    store.set(deleteSessionAtom, 'sb');

    expect(store.get(activeTabIdAtom)).toBe('c');
  });
});
