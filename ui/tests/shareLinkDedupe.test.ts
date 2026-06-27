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
  minifyWorkspace,
  deminifyWorkspace,
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

describe('minifyWorkspace / deminifyWorkspace round-trip', () => {
  it('perfectly round-trips a multi-node history tree with structural relationships', () => {
    const originalTree: Record<string, SerializedHistoryNode> = {
      '0': { id: '0', equation: '2 * (x + 3) = 10', parentId: null, childrenIds: ['step_1'], label: 'Initial', timestamp: 1000 },
      'step_1': { id: 'step_1', equation: 'x + 3 = 5', parentId: '0', childrenIds: ['step_2'], label: 'Transpose', timestamp: 2000 },
      'step_2': { id: 'step_2', equation: 'x = 2', parentId: 'step_1', childrenIds: [], label: 'Simplify', timestamp: 3000 },
    };

    const minified = minifyWorkspace({
      tree: originalTree,
      currentNodeId: 'step_2',
      name: 'Test Name',
    });

    // Check minification format / structure
    expect(minified.v).toBe(1);
    expect(minified.a).toBe('Test Name');
    expect(minified.t['0'].e).toBe('2 * (x + 3) = 10');
    expect(minified.t['0'].p).toBeNull();
    
    // Check that ID sequentialization happened
    const mappedIds = Object.keys(minified.t);
    expect(mappedIds).toContain('0');
    expect(mappedIds).toContain('1');
    expect(mappedIds).toContain('2');
    expect(mappedIds.some(id => id.startsWith('step_'))).toBe(false);

    // De-minify back to standard representation
    const restored = deminifyWorkspace(minified);
    expect(restored.name).toBe('Test Name');

    // Confirm structural integrity and parent-child linkages round-tripped
    const restoredNodes = Object.values(restored.tree);
    expect(restoredNodes).toHaveLength(3);

    const rootNode = restoredNodes.find(n => n.parentId === null);
    expect(rootNode).toBeDefined();
    expect(rootNode!.equation).toBe('2 * (x + 3) = 10');
    expect(rootNode!.childrenIds).toHaveLength(1);

    const step1Id = rootNode!.childrenIds[0];
    const step1Node = restored.tree[step1Id];
    expect(step1Node).toBeDefined();
    expect(step1Node.equation).toBe('x + 3 = 5');
    expect(step1Node.parentId).toBe(rootNode!.id);
    expect(step1Node.childrenIds).toHaveLength(1);

    const step2Id = step1Node.childrenIds[0];
    const step2Node = restored.tree[step2Id];
    expect(step2Node).toBeDefined();
    expect(step2Node.equation).toBe('x = 2');
    expect(step2Node.parentId).toBe(step1Node.id);
    expect(step2Node.childrenIds).toHaveLength(0);

    // Verify current node ID was correctly mapped back to the new step_2 random ID
    expect(restored.currentNodeId).toBe(step2Node.id);
  });
});
