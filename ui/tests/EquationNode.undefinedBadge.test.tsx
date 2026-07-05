// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  undefinedPathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeUndefinedStore(flaggedPath: string) {
  const store = createStore();
  const eq = parseEquation('x/0=5');
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
  store.set(undefinedPathsAtom, [{ path: flaggedPath, reason: 'division-by-zero' as const }]);
  return store;
}

describe('EquationNode undefined (÷0) warning handle (#416)', () => {
  afterEach(cleanup);

  it('renders a warning handle on a division-by-zero subtree, announced for TTS', () => {
    const store = makeUndefinedStore('lhs');
    render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );
    // The handle sits in the action-handle slot but is a dead-end marker, not an
    // action; it carries an accessible name so a screen reader / TTS announces it
    // without needing the hover tooltip.
    const handle = screen.getByRole('img', { name: /undefined.*division by zero/i });
    expect(handle).toBeInTheDocument();
  });

  it('does not render the warning handle on a non-flagged path', () => {
    const store = makeUndefinedStore('lhs');
    render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="rhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );
    expect(screen.queryByRole('img', { name: /division by zero/i })).toBeNull();
  });
});
