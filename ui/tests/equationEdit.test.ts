// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  equationInputModalOpenAtom,
  equationEditSeedAtom,
  openEquationEditorAtom,
  submitEquationEditAtom,
  activeWorkspacePristineAtom,
  parseRawStringToEditSeed,
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation, equationToString } from 'math-engine-client';

const singleNodeTab = (id: string, eq: string): WorkspaceTab => ({
  id,
  name: eq,
  historyTree: {
    '0': { id: '0', equation: parseEquation(eq), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  timestamp: 1,
});

const twoNodeTab = (id: string): WorkspaceTab => ({
  id,
  name: '3 * x = 9',
  historyTree: {
    '0': { id: '0', equation: parseEquation('3*x=9'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
    '1': { id: '1', equation: parseEquation('x=3'), parentId: '0', childrenIds: [], label: 'Divide by 3', timestamp: 2 },
  },
  currentNodeId: '1',
  timestamp: 1,
});

describe('openEquationEditorAtom — seeds the input dialog from the current equation (#261)', () => {
  it('computes a LHS/relation/RHS seed from the active equation and opens the modal', () => {
    const store = createStore();
    store.set(rawTabsAtom, [singleNodeTab('a', '3*x+2=8')]);
    store.set(rawActiveTabIdAtom, 'a');

    store.set(openEquationEditorAtom);

    expect(store.get(equationInputModalOpenAtom)).toBe(true);
    expect(store.get(equationEditSeedAtom)).toEqual({ lhs: '3 * x + 2', relation: '=', rhs: '8' });
  });

  it('seeds from the equation at the CURRENT node, not the root', () => {
    const store = createStore();
    store.set(rawTabsAtom, [twoNodeTab('a')]);
    store.set(rawActiveTabIdAtom, 'a');

    store.set(openEquationEditorAtom);

    expect(store.get(equationEditSeedAtom)).toEqual({ lhs: 'x', relation: '=', rhs: '3' });
  });
});

describe('activeWorkspacePristineAtom — drives the adaptive Edit tooltip (#261)', () => {
  it('is true for a single-node (untouched) workspace', () => {
    const store = createStore();
    store.set(rawTabsAtom, [singleNodeTab('a', 'x=0')]);
    store.set(rawActiveTabIdAtom, 'a');
    expect(store.get(activeWorkspacePristineAtom)).toBe(true);
  });

  it('is false once the workspace has derivation history', () => {
    const store = createStore();
    store.set(rawTabsAtom, [twoNodeTab('a')]);
    store.set(rawActiveTabIdAtom, 'a');
    expect(store.get(activeWorkspacePristineAtom)).toBe(false);
  });
});

describe('submitEquationEditAtom — context-aware edit (#261)', () => {
  it('edits in place when the workspace is pristine (no new tab)', () => {
    const store = createStore();
    store.set(rawTabsAtom, [singleNodeTab('a', 'x=0')]);
    store.set(rawActiveTabIdAtom, 'a');

    store.set(submitEquationEditAtom, 'x = 9');

    const tabs = store.get(rawTabsAtom);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('a');
    expect(Object.keys(tabs[0].historyTree)).toHaveLength(1);
    const node = tabs[0].historyTree[tabs[0].currentNodeId];
    expect(equationToString(node.equation)).toBe('x = 9');
  });

  it('forks a new workspace when the workspace has history, leaving the original intact', () => {
    const store = createStore();
    store.set(rawTabsAtom, [twoNodeTab('a')]);
    store.set(rawActiveTabIdAtom, 'a');

    store.set(submitEquationEditAtom, 'x = 9');

    const tabs = store.get(rawTabsAtom);
    expect(tabs).toHaveLength(2);

    // Original tab is untouched — still two nodes.
    const original = tabs.find(t => t.id === 'a')!;
    expect(Object.keys(original.historyTree)).toHaveLength(2);

    // The new tab is active, single-node, holding the edited equation.
    const activeId = store.get(rawActiveTabIdAtom);
    expect(activeId).not.toBe('a');
    const forked = tabs.find(t => t.id === activeId)!;
    expect(Object.keys(forked.historyTree)).toHaveLength(1);
    expect(equationToString(forked.historyTree[forked.currentNodeId].equation)).toBe('x = 9');
  });

  it('throws and leaves tabs unchanged on an invalid equation', () => {
    const store = createStore();
    store.set(rawTabsAtom, [singleNodeTab('a', 'x=0')]);
    store.set(rawActiveTabIdAtom, 'a');

    expect(() => store.set(submitEquationEditAtom, '3 * = 4')).toThrow();
    const tabs = store.get(rawTabsAtom);
    expect(tabs).toHaveLength(1);
    expect(equationToString(tabs[0].historyTree[tabs[0].currentNodeId].equation)).toBe('x = 0');
  });

  it('renames tab_initial if it is pristine and named Sample Workspace', () => {
    const store = createStore();
    const initialTab: WorkspaceTab = {
      id: DEFAULT_TAB_ID,
      name: DEFAULT_TAB_NAME,
      historyTree: {
        '0': { id: '0', equation: parseEquation('x + 2 = 5'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
      },
      currentNodeId: '0',
      isCustomNamed: true,
      timestamp: 1,
    };
    store.set(rawTabsAtom, [initialTab]);
    store.set(rawActiveTabIdAtom, DEFAULT_TAB_ID);

    store.set(submitEquationEditAtom, 'x = 3');

    const tabs = store.get(rawTabsAtom);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(DEFAULT_TAB_ID);
    expect(tabs[0].name).toBe('x = 3');
    expect(tabs[0].isCustomNamed).toBe(false);
  });
});

describe('parseRawStringToEditSeed', () => {
  it('parses a valid equation string with "=" relation', () => {
    const seed = parseRawStringToEditSeed('3 * x + 2 = 8');
    expect(seed).toEqual({ lhs: '3 * x + 2', relation: '=', rhs: '8' });
  });

  it('parses a string with "<=" relation', () => {
    const seed = parseRawStringToEditSeed('x <= 4');
    expect(seed).toEqual({ lhs: 'x', relation: '<=', rhs: '4' });
  });

  it('handles strings with no relation by putting everything in LHS and setting relation to "="', () => {
    const seed = parseRawStringToEditSeed('3 * x + 2');
    expect(seed).toEqual({ lhs: '3 * x + 2', relation: '=', rhs: '' });
  });

  it('handles strings with trailing/leading spaces correctly', () => {
    const seed = parseRawStringToEditSeed('  x >= y - 1  ');
    expect(seed).toEqual({ lhs: 'x', relation: '>=', rhs: 'y - 1' });
  });
});

