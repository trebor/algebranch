// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import { HANDLE_THEMES } from '@/components/HandleBadge';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  reduciblePathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// #427: a node whose single path offers BOTH an Expand move and a Factor move —
// the product↔sum inverse pair. Options are fabricated (the component just
// renders whatever reduciblePathsAtom carries), so the concrete math is moot.
function makeExpandAndFactorStore() {
  const store = createStore();
  const eq = parseEquation('x+8=0');
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
  store.set(candidatePathsAtom, new Set(['lhs/1']));
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=-8'), type: 'expand', label: 'Distribute' },
      { equation: parseEquation('x=8'), type: 'factor', label: 'Factor' },
    ] as never,
  });
  return store;
}

// A node offering an identity rewrite whose *specific* label is verbose ("Express
// as Square") alongside a multi-option Simplify stack — the cases where the old
// per-option naming leaked a specific/Unicode label onto the handle (#456).
function makeRewriteAndMultiSimplifyStore() {
  const store = createStore();
  const eq = parseEquation('x+8=0');
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
  store.set(candidatePathsAtom, new Set(['lhs/1']));
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=-8'), type: 'reduce', label: 'Simplify Alpha' },
      { equation: parseEquation('x=8'), type: 'reduce', label: 'Simplify Beta' },
      { equation: parseEquation('x=-8'), type: 'identity', label: 'Express as Square' },
    ] as never,
  });
  return store;
}

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

describe('five-handle taxonomy (#427)', () => {
  afterEach(cleanup);

  it('exposes an Expand and a Factor handle theme (mirrored pair)', () => {
    expect(HANDLE_THEMES.expand).toBeDefined();
    expect(HANDLE_THEMES.factor).toBeDefined();
    // The pair is disambiguated by mirrored icons, not by color.
    expect(HANDLE_THEMES.expand.icon).not.toBe(HANDLE_THEMES.factor.icon);
  });

  it('renders both the Expand and Factor handles on a node that offers each', () => {
    renderTree(makeExpandAndFactorStore());
    // Every handle names its operation family, not the specific option (#456):
    // the emerald handle whose sole option is "Distribute" still reads "Expand".
    expect(screen.getByRole('button', { name: 'Expand' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Factor' })).toBeTruthy();
  });

  it('orders Expand before Factor so the inverse pair reads adjacently', () => {
    renderTree(makeExpandAndFactorStore());
    const expand = screen.getByRole('button', { name: 'Expand' });
    const factor = screen.getByRole('button', { name: 'Factor' });
    // DOM order reflects the canonical Simplify · Expand · Factor · … stacking.
    expect(expand.compareDocumentPosition(factor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('handle accessible name is the operation family, not the specific option (#456)', () => {
  afterEach(cleanup);

  it('names a multi-option Simplify stack "Simplify", not "Show simplifications"', () => {
    renderTree(makeRewriteAndMultiSimplifyStore());
    expect(screen.getByRole('button', { name: 'Simplify' })).toBeTruthy();
    // The old count-phrasing is gone: the family name stands alone.
    expect(screen.queryByRole('button', { name: /show simplifications/i })).toBeNull();
  });

  it('names an identity handle "Rewrite", never leaking its verbose option label', () => {
    renderTree(makeRewriteAndMultiSimplifyStore());
    expect(screen.getByRole('button', { name: 'Rewrite' })).toBeTruthy();
    // "Express as Square" belongs in the menu row, not on the handle itself.
    expect(screen.queryByRole('button', { name: /express as square/i })).toBeNull();
  });
});
