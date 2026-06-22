// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  targetPathsAtom,
  sourcePathAtom,
  reduciblePathsAtom,
  currentEquationAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation, equationToString } from 'math-engine-client';

// Seeds a single-tab store whose active workspace holds `eqText` as the current
// equation, so `currentEquationAtom` resolves and EquationNode can walk it.
function makeStore(eqText: string) {
  const store = createStore();
  const eq = parseEquation(eqText);
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

function renderTree(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <EquationNode path="lhs" />
      <EquationNode path="rhs" />
    </Provider>,
  );
}

describe('EquationNode keyboard/a11y semantics', () => {
  afterEach(cleanup);

  it('exposes an actionable candidate node as a labelled, focusable button', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1'])); // the constant 9
    renderTree(store);

    const btn = screen.getByRole('button', { name: /select this term/i });
    expect(btn).toHaveAttribute('tabindex', '0');
  });

  it('gives an actionable node a visible keyboard-focus indicator', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    // A focus-visible ring so keyboard users can see where they are (WCAG 2.4.7).
    const btn = screen.getByRole('button', { name: /select this term/i });
    expect(btn.className).toContain('focus-visible:ring');
  });

  it('does not expose non-actionable nodes as buttons', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    // Only the single candidate term is a button; nothing else in the tree is.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('selects a candidate on Enter', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    fireEvent.keyDown(screen.getByRole('button', { name: /select this term/i }), { key: 'Enter' });
    expect(store.get(sourcePathAtom)).toBe('lhs/1');
  });

  it('deselects the selected node on Escape', () => {
    const store = makeStore('x^2-9=0');
    store.set(sourcePathAtom, 'lhs/1');
    renderTree(store);

    const selected = screen.getByRole('button', { name: /selected term/i });
    fireEvent.keyDown(selected, { key: 'Escape' });
    expect(store.get(sourcePathAtom)).toBeNull();
  });

  it('applies a move when Enter is pressed on a target node', () => {
    const store = makeStore('x^2-9=0');
    store.set(sourcePathAtom, 'lhs/1');
    store.set(targetPathsAtom, { rhs: parseEquation('x^2=9') });
    renderTree(store);

    const target = screen.getByRole('button', { name: /move selection to/i });
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(equationToString(store.get(currentEquationAtom))).toBe(equationToString(parseEquation('x^2=9')));
  });

  it('drops handle buttons from the tab order while a source is selected', () => {
    const store = makeStore('x^2-9=0');
    store.set(reduciblePathsAtom, {
      'lhs/1': [{ equation: parseEquation('x^2-9=0'), type: 'reduce', label: 'Simplify' }],
    });
    store.set(sourcePathAtom, 'lhs/0'); // transposition mode — toolbar is inert
    renderTree(store);

    expect(screen.getByRole('button', { name: /simplify/i })).toHaveAttribute('tabindex', '-1');
  });

  it('keeps handle buttons tabbable when no source is selected', () => {
    const store = makeStore('x^2-9=0');
    store.set(reduciblePathsAtom, {
      'lhs/1': [{ equation: parseEquation('x^2-9=0'), type: 'reduce', label: 'Simplify' }],
    });
    renderTree(store);

    expect(screen.getByRole('button', { name: /simplify/i })).not.toHaveAttribute('tabindex', '-1');
  });

  it('has no structural a11y violations on a candidate subtree', async () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    const { container } = renderTree(store);
    expect(await axe(container)).toHaveNoViolations();
  });
});
