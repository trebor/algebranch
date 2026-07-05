// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { PreviewEquationNode } from '@/components/PreviewEquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';
import type * as math from 'mathjs';

function makePrecedenceStore(unwrapParens = true) {
  const store = createStore();
  const eq = parseEquation('(x*x-x*1)*(x+1)*(x+2)=3');
  
  if (unwrapParens) {
    // eq.lhs is * [ * [ (x * x - x * 1), (x + 1) ], (x + 2) ]
    // The left child of the inner * is at path lhs/0/0, which is ParenthesisNode.
    // Let's unwrap the ParenthesisNode, leaving a bare OperatorNode.
    const outerMul = eq.lhs as math.OperatorNode;
    const innerMul = outerMul.args[0] as math.OperatorNode;
    const parenNode = innerMul.args[0] as math.ParenthesisNode;
    innerMul.args[0] = parenNode.content; // bare OperatorNode (x * x - x * 1)
  }

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
  return { store, eq };
}

describe('Precedence-aware parenthesization (#410)', () => {
  afterEach(cleanup);

  it('EquationNode renders grouping parentheses for bare compound operator base', () => {
    const { store } = makePrecedenceStore(true);
    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <EquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );

    // Bypassing ParenthesisNode, it should still render <svg> parentheses around lhs/0/0
    const target = container.querySelector('[data-node-path="lhs/0/0"]');
    expect(target).not.toBeNull();
    
    // Check that we have SVG paths for LeftParenSVG / RightParenSVG inside lhs/0/0's rendered content
    const svgPaths = target?.querySelectorAll('path');
    expect(svgPaths?.length).toBeGreaterThanOrEqual(2);
    
    // Left parenthesis SVG path
    const leftPath = [...(svgPaths || [])].some(p => p.getAttribute('d')?.includes('M 6,3'));
    expect(leftPath).toBe(true);

    // Right parenthesis SVG path
    const rightPath = [...(svgPaths || [])].some(p => p.getAttribute('d')?.includes('M 2,3'));
    expect(rightPath).toBe(true);
  });

  it('PreviewEquationNode renders grouping parentheses for bare compound operator base', () => {
    const { store, eq } = makePrecedenceStore(true);
    const { container } = render(
      <Provider store={store}>
        <RovingTabindexProvider>
          <div role="tree" aria-label="Equation">
            <PreviewEquationNode path="lhs" />
          </div>
        </RovingTabindexProvider>
      </Provider>,
    );

    const outerMul = eq.lhs as math.OperatorNode;
    const innerMul = outerMul.args[0] as math.OperatorNode;
    const bareNode = innerMul.args[0];
    const bareNodeId = (bareNode as unknown as { id?: string }).id;

    const target = container.querySelector(`[data-flip-id="${bareNodeId}"]`);
    expect(target).not.toBeNull();
    
    const svgPaths = target?.querySelectorAll('path');
    expect(svgPaths?.length).toBeGreaterThanOrEqual(2);

    const leftPath = [...(svgPaths || [])].some(p => p.getAttribute('d')?.includes('M 6,3'));
    expect(leftPath).toBe(true);

    const rightPath = [...(svgPaths || [])].some(p => p.getAttribute('d')?.includes('M 2,3'));
    expect(rightPath).toBe(true);
  });
});
