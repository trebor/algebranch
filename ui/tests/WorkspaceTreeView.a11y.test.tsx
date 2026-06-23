// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { WorkspaceTreeView } from '@/components/WorkspaceTreeView';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// A two-step derivation: root "0" -> child "1" (the current step).
function makeStore(currentNodeId = '1') {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: parseEquation('x=2'), parentId: '0', childrenIds: [], label: 'Subtract 1', timestamp: 2 },
    },
    currentNodeId,
    isCustomNamed: true,
    timestamp: 2,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

function renderTree(store: ReturnType<typeof createStore>, interactive = true) {
  return render(
    <Provider store={store}>
      <WorkspaceTreeView interactive={interactive} scrollActiveIntoView={false} />
    </Provider>,
  );
}

describe('WorkspaceTreeView keyboard/a11y semantics', () => {
  afterEach(cleanup);

  it('exposes the current step as the single Tab stop, labelled by its step number', () => {
    renderTree(makeStore('1'));
    // The composite widget is one Tab stop: the current step is tabbable, the rest
    // rove via arrow keys.
    expect(screen.getByRole('treeitem', { name: /step 1/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('treeitem', { name: /step 0/i })).toHaveAttribute('tabindex', '-1');
  });

  it('leads the step label with the action, not the raw equation string', () => {
    renderTree(makeStore());
    // The operation ("Subtract 1") is the spoken identity; the raw symbol string
    // ("x=2") is not crammed into the accessible name (deferred to math-speech work).
    const step = screen.getByRole('treeitem', { name: /step 1/i });
    expect(step).toHaveAccessibleName(/subtract 1/i);
    expect(step.getAttribute('aria-label')).not.toContain('x=2');
  });

  it('marks the current step as the current selection', () => {
    renderTree(makeStore('1'));
    expect(screen.getByRole('treeitem', { name: /step 1/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('treeitem', { name: /step 0/i })).not.toHaveAttribute('aria-current', 'step');
  });

  it('selects a step on Enter', () => {
    const store = makeStore('1');
    renderTree(store);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /step 0/i }), { key: 'Enter' });
    // currentNodeId tracks the active tab's pointer; selecting step 0 moves it there.
    expect(store.get(rawTabsAtom)[0].currentNodeId).toBe('0');
  });

  it('does not expose step nodes as treeitems in a read-only preview', () => {
    renderTree(makeStore(), false);
    expect(screen.queryByRole('treeitem', { name: /step 0/i })).toBeNull();
  });
});
