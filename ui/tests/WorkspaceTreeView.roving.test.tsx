// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Provider, createStore } from 'jotai';
import { WorkspaceTreeView } from '@/components/WorkspaceTreeView';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// A branching derivation so parent/child (Up/Down) and sibling (Left/Right) nav
// can both be exercised:
//   step 0 ──┬── step 1 ── step 3
//            └── step 2
function makeStore(currentNodeId = '1') {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: ['1', '2'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: parseEquation('x=2'), parentId: '0', childrenIds: ['3'], label: 'Subtract 1', timestamp: 2 },
      '2': { id: '2', equation: parseEquation('x+1-3=0'), parentId: '0', childrenIds: [], label: 'Move all', timestamp: 3 },
      '3': { id: '3', equation: parseEquation('x=5'), parentId: '1', childrenIds: [], label: 'Done', timestamp: 4 },
    },
    currentNodeId,
    isCustomNamed: true,
    timestamp: 4,
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

const step = (n: number) => screen.getByRole('treeitem', { name: new RegExp(`step ${n}\\b`, 'i') });

describe('WorkspaceTreeView composite widget (#257)', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(cleanup);

  it('wraps the steps in a labelled tree', () => {
    renderTree(makeStore());
    const tree = screen.getByRole('tree', { name: /history/i });
    expect(within(tree).getAllByRole('treeitem').length).toBeGreaterThanOrEqual(4);
  });

  it('is a single Tab stop: only the current step is tabIndex 0', () => {
    renderTree(makeStore('1'));
    expect(step(1)).toHaveAttribute('tabindex', '0');
    expect(step(0)).toHaveAttribute('tabindex', '-1');
    expect(step(2)).toHaveAttribute('tabindex', '-1');
  });

  it('marks the current step with aria-selected and aria-current', () => {
    renderTree(makeStore('1'));
    expect(step(1)).toHaveAttribute('aria-selected', 'true');
    expect(step(1)).toHaveAttribute('aria-current', 'step');
    expect(step(0)).toHaveAttribute('aria-selected', 'false');
  });

  it('roves to the parent step with ArrowUp and a child step with ArrowDown', () => {
    renderTree(makeStore('1'));
    act(() => step(1).focus());

    fireEvent.keyDown(step(1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(step(0));

    fireEvent.keyDown(step(0), { key: 'ArrowDown' });
    // First child of step 0 in visual order; step 1 is created before step 2.
    expect(document.activeElement).toBe(step(1));
  });

  it('roves between sibling branches with ArrowRight / ArrowLeft', () => {
    renderTree(makeStore('1'));
    act(() => step(1).focus());

    fireEvent.keyDown(step(1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(step(2));

    fireEvent.keyDown(step(2), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(step(1));
  });

  it('selects a step on Enter', () => {
    const store = makeStore('1');
    renderTree(store);
    fireEvent.keyDown(step(0), { key: 'Enter' });
    expect(store.get(rawTabsAtom)[0].currentNodeId).toBe('0');
  });

  it('copies the focused step with the C key', () => {
    renderTree(makeStore('1'));
    fireEvent.keyDown(step(1), { key: 'c' });
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it('keeps the copy trigger out of the focus order (single Tab stop)', () => {
    renderTree(makeStore('1'));
    // The per-step copy split-button is mouse-operable but not a Tab stop — the
    // tree is a single composite widget and copy is reached via the C key.
    const copy = screen.getAllByRole('button', { name: /copy equation/i });
    expect(copy.length).toBeGreaterThan(0);
    copy.forEach((btn) => expect(btn).toHaveAttribute('tabindex', '-1'));
  });

  it('has no structural a11y violations (treeitem, no button-in-button)', async () => {
    const { container } = renderTree(makeStore());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('does not expose step nodes as treeitems in a read-only preview', () => {
    renderTree(makeStore(), false);
    expect(screen.queryByRole('treeitem')).toBeNull();
  });
});
