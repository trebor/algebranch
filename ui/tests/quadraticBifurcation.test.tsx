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
  candidatePathsAtom,
  reduciblePathsAtom,
  historyTreeAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation, getReducibleOptions } from 'math-engine';

describe('Quadratic Formula Auto-Bifurcation (#583)', () => {
  afterEach(cleanup);

  it('offers a single Apply Quadratic Formula (±) option and automatically splits the history tree into two branches', () => {
    const store = createStore();
    const eq = parseEquation('x^2 - 5*x + 6 = 0');
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

    const reductions = getReducibleOptions(eq);
    const parsedReducible: Record<string, { equation: typeof eq; type: 'reduce' | 'expand' | 'factor' | 'identity'; label?: string }[]> = {};
    for (const [p, opts] of Object.entries(reductions)) {
      parsedReducible[p] = opts.map((o) => ({
        equation: o.simplified,
        type: o.type as 'reduce' | 'expand' | 'factor' | 'identity',
        label: o.label,
      }));
    }
    store.set(candidatePathsAtom, new Set(Object.keys(reductions)));
    store.set(reduciblePathsAtom, parsedReducible as never);

    render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
            <EquationNode path="rhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>
    );

    // Find the Rewrite handle for the quadratic equation
    const rewriteHandles = screen.getAllByRole('button', { name: 'Rewrite' });
    expect(rewriteHandles.length).toBeGreaterThan(0);

    let quadFormulaOption: HTMLElement | undefined;
    for (const handle of rewriteHandles) {
      fireEvent.click(handle, { detail: 1 });
      const menuItems = screen.queryAllByRole('menuitem');
      const found = menuItems.find((m) =>
        m.textContent?.includes('Apply Quadratic Formula')
      );
      if (found) {
        quadFormulaOption = found;
        const allQuadOptions = menuItems.filter((m) =>
          m.textContent?.includes('Apply Quadratic Formula')
        );
        expect(allQuadOptions).toHaveLength(1);
        expect(allQuadOptions[0].textContent).toContain('Apply Quadratic Formula (±)');
        break;
      }
      // close menu if not the one
      fireEvent.click(handle, { detail: 1 });
    }

    expect(quadFormulaOption).toBeDefined();

    // Click the unified option
    fireEvent.click(quadFormulaOption!, { detail: 1 });

    // History tree must have 2 sibling branches under root
    const tree = store.get(historyTreeAtom);
    const rootNode = tree['0'];
    expect(rootNode.childrenIds).toHaveLength(2);

    const child1 = tree[rootNode.childrenIds[0]];
    const child2 = tree[rootNode.childrenIds[1]];

    expect(child1.label).toBe('Apply Quadratic Formula (+)');
    expect(child1.bifurcation?.totalBranches).toBe(2);
    expect(child1.bifurcation?.branchIndex).toBe(1);

    expect(child2.label).toBe('Apply Quadratic Formula (-)');
    expect(child2.bifurcation?.totalBranches).toBe(2);
    expect(child2.bifurcation?.branchIndex).toBe(2);
    expect(child2.bifurcation?.groupId).toBe(child1.bifurcation?.groupId);
  });
});
