// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  sourcePathAtom,
  candidatePathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// 7 / (n - 1) = 5. The narrow denominator (n - 1) at lhs/1 is a transposition
// candidate, but under a wide bar its empty side gutters fall inside the parent
// fraction's click box and steal clicks for the whole fraction (#313). A
// row-filling hit layer on the denominator must claim those gutter clicks for the
// denominator itself.
const makeFractionStore = () => {
  const store = createStore();
  const eq = parseEquation('7/(n-1)=5');
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
  store.set(sourcePathAtom, null);
  // Only the denominator is a live candidate.
  store.set(candidatePathsAtom, new Set<string>(['lhs/1']));
  return store;
}

describe('EquationNode fraction gutter hit area (#313)', () => {
  afterEach(cleanup);

  it('selects the denominator (not the whole fraction) when its row gutter is clicked', () => {
    const store = makeFractionStore();
    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );

    // jsdom has no geometry, so we can't click an actual gutter pixel. Target the
    // denominator's row-filling hit wrapper directly to exercise the wiring: a
    // click on it must activate the denominator, not bubble to the fraction.
    const hitLayers = Array.from(container.querySelectorAll('[data-fill-row-hit]'));
    const denomHit = hitLayers.find((el) => /n/.test(el.textContent ?? ''));
    expect(denomHit).toBeTruthy();

    fireEvent.click(denomHit as Element);

    expect(store.get(sourcePathAtom)).toBe('lhs/1');
  });
});
