// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Share-link arrival dedupe (#299): when a `?ws=` workspace or `?eq=` equation
// link matches a workspace the user already has (by hashWorkspace content hash),
// open the existing one instead of spawning a duplicate tab.
import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  savedSessionsAtom,
  rawTabsAtom,
  rawActiveTabIdAtom,
  currentSessionIdAtom,
  createSessionFromStateAtom,
  createNewSessionAtom,
  toastAtom,
  serializeTree,
  type SavedSession,
  type SerializedHistoryNode,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

const DEDUPE_TOAST = 'You already have this workspace — opened it.';

/** A serialized single-node tree for `eqStr`, matching what a fresh session stores. */
const pristineTree = (eqStr: string): Record<string, SerializedHistoryNode> =>
  serializeTree({
    '0': { id: '0', equation: parseEquation(eqStr), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  });

/** A pristine saved session named exactly as createNewSession would name it (`eqStr`). */
const pristineSession = (id: string, eqStr: string): SavedSession => ({
  id,
  name: eqStr,
  timestamp: 1,
  tree: pristineTree(eqStr),
  currentNodeId: '0',
});

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

const seededStore = (sessions: SavedSession[]) => {
  const store = createStore();
  store.set(rawTabsAtom, [emptyTab('scratch')]);
  store.set(rawActiveTabIdAtom, 'scratch');
  store.set(savedSessionsAtom, sessions);
  return store;
};

describe('createSessionFromStateAtom — ?ws= arrival dedupe (#299)', () => {
  it('opens the existing workspace on a content-hash match instead of duplicating', () => {
    const existing: SavedSession = {
      id: 'ws-1',
      name: 'My Derivation',
      timestamp: 1,
      tree: pristineTree('x^2-9=0'),
      currentNodeId: '0',
    };
    const store = seededStore([existing]);

    const result = store.set(createSessionFromStateAtom, {
      tree: existing.tree,
      currentNodeId: existing.currentNodeId,
      name: existing.name,
    });

    expect(result).toEqual({ matched: true });
    expect(store.get(savedSessionsAtom)).toHaveLength(1);
    expect(store.get(currentSessionIdAtom)).toBe('ws-1');
    expect(store.get(toastAtom)?.message).toBe(DEDUPE_TOAST);
  });

  it('creates a new workspace when the incoming content does not match', () => {
    const store = seededStore([
      { id: 'ws-1', name: 'My Derivation', timestamp: 1, tree: pristineTree('x^2-9=0'), currentNodeId: '0' },
    ]);

    const result = store.set(createSessionFromStateAtom, {
      tree: pristineTree('2*x+5=13'),
      currentNodeId: '0',
      name: 'Different',
    });

    expect(result).toEqual({ matched: false });
    expect(store.get(savedSessionsAtom)).toHaveLength(2);
  });
});

describe('createNewSessionAtom — ?eq= arrival dedupe (#299)', () => {
  it('opens the existing pristine workspace on a match when dedupe is requested', () => {
    const store = seededStore([pristineSession('eq-1', 'x^2-9=0')]);

    const result = store.set(createNewSessionAtom, 'x^2-9=0', undefined, { dedupe: true });

    expect(result).toEqual({ matched: true });
    expect(store.get(savedSessionsAtom)).toHaveLength(1);
    expect(store.get(currentSessionIdAtom)).toBe('eq-1');
    expect(store.get(toastAtom)?.message).toBe(DEDUPE_TOAST);
  });

  it('creates a new workspace when no pristine workspace matches', () => {
    const store = seededStore([pristineSession('eq-1', 'x^2-9=0')]);

    const result = store.set(createNewSessionAtom, '2*x+5=13', undefined, { dedupe: true });

    expect(result).toEqual({ matched: false });
    expect(store.get(savedSessionsAtom)).toHaveLength(2);
  });

  it('does not match a further-derived workspace sharing the same starting equation (pristine-only)', () => {
    // A workspace that started from x^2-9=0 but has an extra derivation node.
    const derivedTree = serializeTree({
      '0': { id: '0', equation: parseEquation('x^2-9=0'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: parseEquation('x^2=9'), parentId: '0', childrenIds: [], label: 'Add 9', timestamp: 2 },
    });
    const store = seededStore([{ id: 'eq-1', name: 'x^2-9=0', timestamp: 1, tree: derivedTree, currentNodeId: '1' }]);

    const result = store.set(createNewSessionAtom, 'x^2-9=0', undefined, { dedupe: true });

    expect(result).toEqual({ matched: false });
    expect(store.get(savedSessionsAtom)).toHaveLength(2);
  });

  it('always appends when dedupe is not requested (tutorial/clone path unaffected)', () => {
    const store = seededStore([pristineSession('eq-1', 'x^2-9=0')]);

    store.set(createNewSessionAtom, 'x^2-9=0');

    expect(store.get(savedSessionsAtom)).toHaveLength(2);
  });
});
