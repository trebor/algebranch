// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
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

// The expression is a composite widget (#257): a single Tab stop with arrow-key
// roving, so the harness mirrors the app — a role="tree" container inside the
// roving provider.
function renderTree(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <RovingTabindexProvider>
        <div role="tree" aria-label="Equation">
          <EquationNode path="lhs" />
          <EquationNode path="rhs" />
        </div>
      </RovingTabindexProvider>
    </Provider>,
  );
}

describe('EquationNode keyboard/a11y semantics', () => {
  afterEach(cleanup);

  it('exposes an actionable candidate node as a labelled treeitem', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1'])); // the constant 9
    renderTree(store);

    const item = screen.getByRole('treeitem', { name: /Enter to select/i });
    // The single candidate is the active item, so it is the one Tab stop.
    expect(item).toHaveAttribute('tabindex', '0');
  });

  it('gives an actionable node a visible keyboard-focus indicator', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    const item = screen.getByRole('treeitem', { name: /Enter to select/i });
    expect(item.className).toContain('focus-visible:ring');
  });

  it('exposes candidate terms as treeitems, not buttons', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    expect(screen.getAllByRole('treeitem')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('marks the selected term with aria-selected', () => {
    const store = makeStore('x^2-9=0');
    store.set(sourcePathAtom, 'lhs/1');
    renderTree(store);

    expect(screen.getByRole('treeitem', { name: /, selected/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects a candidate on Enter', () => {
    const store = makeStore('x^2-9=0');
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    renderTree(store);

    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Enter to select/i }), { key: 'Enter' });
    expect(store.get(sourcePathAtom)).toBe('lhs/1');
  });

  it('deselects the selected node on Escape', () => {
    const store = makeStore('x^2-9=0');
    store.set(sourcePathAtom, 'lhs/1');
    renderTree(store);

    fireEvent.keyDown(screen.getByRole('treeitem', { name: /, selected/i }), { key: 'Escape' });
    expect(store.get(sourcePathAtom)).toBeNull();
  });

  it('applies a move when Enter is pressed on a target node', () => {
    const store = makeStore('x^2-9=0');
    store.set(sourcePathAtom, 'lhs/1');
    store.set(targetPathsAtom, { rhs: parseEquation('x^2=9') });
    renderTree(store);

    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Enter to move here/i }), { key: 'Enter' });
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

  it('has no structural a11y violations when candidate terms nest (group wrapper)', async () => {
    // A treeitem nested directly inside another treeitem violates
    // aria-required-parent; the non-leaf treeitem wraps its content in a
    // role="group" so the inner treeitem has a valid parent (#257, PR B).
    const store = makeStore('x^2-9=0');
    // lhs (x^2-9) and lhs/0 (x^2) are both candidates → nested treeitems.
    store.set(candidatePathsAtom, new Set(['lhs', 'lhs/0']));
    const { container } = renderTree(store);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no structural a11y violations when a non-candidate node carries a handle', async () => {
    // A handle <button> nested in a bare div under role="tree" violates
    // aria-required-children; folding it into a treeitem (#257, PR B) keeps the
    // tree valid even when the handle's node is not a transposition candidate.
    const store = makeStore('x^2-9=0');
    store.set(reduciblePathsAtom, {
      'lhs/1': [{ equation: parseEquation('x^2=9'), type: 'reduce', label: 'Simplify' }],
    });
    const { container } = renderTree(store);
    expect(await axe(container)).toHaveNoViolations();
  });
});
