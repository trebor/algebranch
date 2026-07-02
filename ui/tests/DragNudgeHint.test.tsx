// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { DragNudgeHint } from '@/components/DragNudgeHint';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  dragNudgeAtom,
  dragNudgeDismissedAtom,
  sourcePathAtom,
  safeLocalStorage,
  DRAG_NUDGE_DISMISSED_KEY,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// `x + 3·y = 7`; the picked-up term is the product `3·y` at lhs/1, so the card's
// preview must show a real subexpression, not just a bare leaf.
function makeStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x + 3*y = 7'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  store.set(dragNudgeAtom, { path: 'lhs/1' });
  store.set(sourcePathAtom, 'lhs/1');
  return store;
}

const renderHint = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <DragNudgeHint />
    </Provider>,
  );

beforeEach(() => safeLocalStorage.removeItem(DRAG_NUDGE_DISMISSED_KEY));
afterEach(cleanup);

describe('DragNudgeHint (#386)', () => {
  it('renders the two-tap coaching copy in a labeled group when a nudge is set', () => {
    const store = makeStore();
    renderHint(store);
    expect(screen.getByRole('group', { name: /two taps to move/i })).toBeInTheDocument();
    expect(screen.getByText(/moving a term takes two taps/i)).toBeInTheDocument();
    expect(screen.getByText(/tap a green glowing target/i)).toBeInTheDocument();
  });

  it('shows a live preview of the picked-up subexpression', () => {
    const store = makeStore(); // picked up lhs/1 = `3*y`
    renderHint(store);
    const group = screen.getByRole('group', { name: /two taps to move/i });
    // The preview renders the real operands of the selected term (3 and y).
    expect(group).toHaveTextContent('3');
    expect(group).toHaveTextContent('y');
    expect(screen.getByText(/you selected/i)).toBeInTheDocument();
  });

  it('renders nothing when there is no active nudge', () => {
    const store = createStore(); // dragNudgeAtom defaults to null
    const { container } = renderHint(store);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('checking "Don\'t show this again" persists the permanent dismissal and closes', () => {
    const store = makeStore();
    renderHint(store);
    fireEvent.click(screen.getByRole('checkbox'));

    expect(store.get(dragNudgeDismissedAtom)).toBe(true);
    expect(safeLocalStorage.getItem(DRAG_NUDGE_DISMISSED_KEY)).toBe('true');
    expect(store.get(dragNudgeAtom)).toBeNull();
  });

  it('Escape dismisses without persisting (there is no auto-dismiss timer)', () => {
    const store = makeStore();
    renderHint(store);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(store.get(dragNudgeAtom)).toBeNull();
    expect(store.get(dragNudgeDismissedAtom)).toBe(false);
    expect(safeLocalStorage.getItem(DRAG_NUDGE_DISMISSED_KEY)).toBeNull();
  });

  it('the close button dismisses without persisting, so the hint can return', () => {
    const store = makeStore();
    renderHint(store);
    fireEvent.click(screen.getByRole('button', { name: /dismiss hint/i }));

    expect(store.get(dragNudgeAtom)).toBeNull();
    expect(store.get(dragNudgeDismissedAtom)).toBe(false);
    expect(safeLocalStorage.getItem(DRAG_NUDGE_DISMISSED_KEY)).toBeNull();
  });
});
