// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  reduciblePathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

describe('EquationNode radical index handle padding (#393)', () => {
  afterEach(cleanup);

  it('reserves space at the top of the parent nthRoot node when the short-digit index carries a handle', () => {
    const store = createStore();
    const eq = parseEquation('nthRoot(x, 64) = 0');
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

    // Make the index '64' at 'lhs/1' carry a handle
    store.set(candidatePathsAtom, new Set(['lhs/1']));
    store.set(reduciblePathsAtom, {
      'lhs/1': [
        { equation: parseEquation('nthRoot(x, 8^2) = 0'), type: 'reduce', label: 'Rewrite 64' },
      ] as never,
    });

    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>
    );

    // In the unified design, the index node itself ('lhs/1') retains its normal handle padding
    // to separate handles from the text.
    const indexNode = container.querySelector('[data-node-path="lhs/1"]');
    expect(indexNode).toBeInTheDocument();

    const indexStyle = window.getComputedStyle(indexNode!);
    // Since handleReserve calculates:
    // ((layout.btnTop + layout.btnSize + layout.textGap) * HANDLE_REM) rem
    // = (0.22 + 0.8 + 0.07) * 1.2 = 1.09 * 1.2 = 1.308rem.
    expect(indexStyle.paddingTop).toContain('1.3080rem');

    // The parent 'nthRoot' node ('lhs') does not need handle padding reserved at its level,
    // since the index's handles are inside the index node's padding, and the bare text is
    // seated in the crook.
    const lhsNode = container.querySelector('[data-node-path="lhs"]');
    expect(lhsNode).toBeInTheDocument();
    const parentStyle = window.getComputedStyle(lhsNode!);
    expect(parentStyle.paddingTop).not.toContain('1.3080rem');
  });

  it('does NOT reserve top space on the parent nthRoot node when the short-digit index does NOT carry a handle', () => {
    const store = createStore();
    const eq = parseEquation('nthRoot(x, 64) = 0');
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

    // No handles on the index
    store.set(candidatePathsAtom, new Set());
    store.set(reduciblePathsAtom, {});

    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>
    );

    const lhsNode = container.querySelector('[data-node-path="lhs"]');
    expect(lhsNode).toBeInTheDocument();

    const style = window.getComputedStyle(lhsNode!);
    // Normal nodePy is 0.18em. So it should not be the rem-based handle reserve.
    expect(style.paddingTop).not.toContain('1.3080rem');
    expect(style.paddingTop).toContain('0.18em');
  });
});
