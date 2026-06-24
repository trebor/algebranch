// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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

// A contradiction (3=2) reached by a substitution that assumed x ≠ 0 — the case
// the issue cites as an edge/node confusion: the ≠ 0 caveat belongs to the step,
// the contradiction to the state.
function makeContradictionStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': {
        id: '1',
        equation: parseEquation('3=2'),
        parentId: '0',
        childrenIds: [],
        label: 'Substitute',
        timestamp: 2,
        change: { kind: 'rewrite', op: 'substitute', text: 'substitute the known value', assumptions: ['x ≠ 0'] },
      },
    },
    currentNodeId: '1',
    isCustomNamed: true,
    timestamp: 2,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('WorkspaceTreeView transition badges on edges (#103)', () => {
  afterEach(cleanup);

  it('renders the connector transition handle as decorative, out of the tab order', () => {
    const { container } = renderTree(makeStore('1'));
    // The single 0 -> 1 connection gets one handle. It is a sighted-mouse
    // affordance: aria-hidden and not focusable, so it never becomes a second
    // Tab stop nor an invalid non-treeitem child of role="tree".
    const handles = container.querySelectorAll('button[aria-hidden="true"]');
    expect(handles.length).toBe(1);
    expect(handles[0]).toHaveAttribute('tabindex', '-1');
    // The transition glyph is the operation ("Subtract 1" -> minus), not equation state.
    expect(within(handles[0] as HTMLElement).getByText('−')).toBeInTheDocument();
  });

  it('keeps the contradiction (state) on the node but moves substitute/restriction (transition) off the node corner', () => {
    const { container } = renderTree(makeContradictionStore());
    const step = screen.getByRole('treeitem', { name: /step 1/i });
    // State badge — the contradiction — stays pinned to the node.
    expect(step.querySelector('.lucide-circle-slash')).not.toBeNull();
    // Transition badges (substitution + ≠0 restriction) are no longer on the node corner.
    expect(step.querySelector('.lucide-replace')).toBeNull();
    expect(step.querySelector('.lucide-triangle-alert')).toBeNull();
    // The substitution moved onto the incoming connector handle (decorative).
    const handle = container.querySelector('button[aria-hidden="true"]');
    expect(handle).not.toBeNull();
    expect(handle!.querySelector('.lucide-replace')).not.toBeNull();
  });

  it('still has exactly one Tab stop with the connector handles present', () => {
    renderTree(makeStore('1'));
    // Edge handles do not regress the #257 single-Tab-stop composite.
    const tabbable = screen.getAllByRole('treeitem').filter((el) => el.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });
});
