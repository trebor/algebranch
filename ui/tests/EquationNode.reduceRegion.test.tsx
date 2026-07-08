// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import { THEME_GLASS } from '@/constants/theme';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  hoverReducePathAtom,
  hoverReduceTypeAtom,
  type WorkspaceTab,
} from '@/store/equation';

// x + 3 = 10 with the constant 3 (lhs/1) marked as the hovered reduce region.
function makeStore() {
  const store = createStore();
  const eq = ensureNodeIds(parseEquation('x + 3 = 10'));
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
  return store;
}

const renderLhs = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <RovingTabindexProvider>
        <div role="tree" aria-label="Equation">
          <EquationNode path="lhs" />
        </div>
      </RovingTabindexProvider>
    </Provider>,
  );

// The accent colour class (e.g. ring-amber-400/70) is the distinctive part;
// the leading `ring-2` is shared across every region token and the focus ring.
const ringClass = (token: string) => token.split(' ')[1];

describe('EquationNode live reduce-region highlight (#423 part 2)', () => {
  afterEach(cleanup);

  it('lights the hovered reduce-region root in the stack accent colour', () => {
    const store = makeStore();
    store.set(hoverReducePathAtom, 'lhs/1');
    store.set(hoverReduceTypeAtom, 'reduce');
    const { container } = renderLhs(store);

    const root = container.querySelector('[data-node-path="lhs/1"]');
    expect(root).not.toBeNull();
    expect((root as Element).className).toContain(ringClass(THEME_GLASS.REDUCE_REGION_SIMPLIFY));
  });

  it('does not light sibling nodes outside the region', () => {
    const store = makeStore();
    store.set(hoverReducePathAtom, 'lhs/1');
    store.set(hoverReduceTypeAtom, 'reduce');
    const { container } = renderLhs(store);

    const sibling = container.querySelector('[data-node-path="lhs/0"]');
    expect(sibling).not.toBeNull();
    expect((sibling as Element).className).not.toContain(ringClass(THEME_GLASS.REDUCE_REGION_SIMPLIFY));
  });

  it('lights nothing when no reduce path is hovered', () => {
    const store = makeStore();
    const { container } = renderLhs(store);

    const node = container.querySelector('[data-node-path="lhs/1"]');
    expect((node as Element).className).not.toContain(ringClass(THEME_GLASS.REDUCE_REGION_SIMPLIFY));
  });
});
