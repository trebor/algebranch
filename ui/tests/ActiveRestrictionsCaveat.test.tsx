// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The standing "given x ≠ 0" caveat (#486) surfaces the domain restrictions (#63)
// active on the current branch under the main equation, so a working answer never
// hides a condition it depends on. It reads the accumulated set from the current
// path — appearing only when earned, and stacking independent restrictions.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ActiveRestrictionsCaveat } from '@/components/ActiveRestrictionsCaveat';
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

// 0 → 1 (assumes x ≠ 0) → 2 (assumes y ≠ 0).
const tree: Record<string, HistoryNode> = {
  '0': { id: '0', equation: parseEquation('x*y=1'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
  '1': { id: '1', equation: parseEquation('y=1/x'), parentId: '0', childrenIds: ['2'], label: 'div x', timestamp: 2, change: divide('x', ['x ≠ 0']) },
  '2': { id: '2', equation: parseEquation('1=1/(x*y)'), parentId: '1', childrenIds: [], label: 'div y', timestamp: 3, change: divide('y', ['y ≠ 0']) },
};

function storeAt(currentNodeId: string) {
  const store = createStore();
  const tab: WorkspaceTab = { id: 'a', name: 'w', historyTree: tree, currentNodeId, isCustomNamed: true, timestamp: 1 };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('ActiveRestrictionsCaveat (#486)', () => {
  afterEach(cleanup);

  it('renders nothing at the root, where no restriction is yet active', () => {
    const { container } = render(<Provider store={storeAt('0')}><ActiveRestrictionsCaveat /></Provider>);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the introduced restriction on the step that assumes it', () => {
    render(<Provider store={storeAt('1')}><ActiveRestrictionsCaveat /></Provider>);
    expect(screen.getByText('given x ≠ 0')).toBeInTheDocument();
  });

  it('stacks restrictions accumulated down the branch at the current answer', () => {
    render(<Provider store={storeAt('2')}><ActiveRestrictionsCaveat /></Provider>);
    expect(screen.getByText('given x ≠ 0, y ≠ 0')).toBeInTheDocument();
  });
});
