// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  sourcePathAtom,
  targetPathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// x·y = 2 with the factor x (lhs/0) selected as the transposition source and the
// rhs marked as a drop target. Moving x across the equals divides both sides by x,
// so the move carries a domain restriction x ≠ 0 that the preview must surface.
function makeTranspositionStore() {
  const store = createStore();
  const eq = parseEquation('x*y=2');
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: { '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 } },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  store.set(sourcePathAtom, 'lhs/0');
  store.set(targetPathsAtom, { rhs: parseEquation('y=2/x') });
  return store;
}

describe('EquationNode transposition preview (#103)', () => {
  afterEach(cleanup);

  it('surfaces the domain restriction in the Preview Move tooltip', async () => {
    const store = makeTranspositionStore();
    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="rhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );
    const target = container.querySelector('[data-eq-node]');
    expect(target).not.toBeNull();
    fireEvent.mouseEnter(target as Element);
    // The caveat that the move assumes x ≠ 0 must show *before* you commit it,
    // mirroring the restriction badge that lands on the resulting connector.
    expect(await screen.findByText(/x ≠ 0/i)).toBeInTheDocument();
  });
});
