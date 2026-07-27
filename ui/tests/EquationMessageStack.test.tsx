// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { Provider, createStore } from 'jotai';
import { EquationMessageStack } from '@/components/EquationMessageStack';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab, type HistoryNode } from '@/store/equation';
import { parseEquation } from 'math-engine-client';
import type { StepChange } from 'math-engine';

const divide = (operand: string, assumptions?: readonly string[]): StepChange => ({
  kind: 'bothSides',
  op: 'divide',
  operand,
  text: `divide both sides by ${operand}`,
  ...(assumptions?.length ? { assumptions } : {}),
});

const tree: Record<string, HistoryNode> = {
  '0': { id: '0', equation: parseEquation('x*y=1'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
  '1': { id: '1', equation: parseEquation('y=1/x'), parentId: '0', childrenIds: [], label: 'div x', timestamp: 2, change: divide('x', ['x ≠ 0']) },
};

function storeAt(currentNodeId: string) {
  const store = createStore();
  const tab: WorkspaceTab = { id: 'a', name: 'w', historyTree: tree, currentNodeId, isCustomNamed: true, timestamp: 1 };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('EquationMessageStack Container (#569)', () => {
  afterEach(cleanup);

  it('renders stacked active banners in priority sequence', () => {
    render(
      <Provider store={storeAt('1')}>
        <EquationMessageStack />
      </Provider>
    );

    expect(screen.getByText('given x ≠ 0')).toBeInTheDocument();
  });
});
