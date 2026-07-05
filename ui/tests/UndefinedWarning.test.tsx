// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { parseEquation } from 'math-engine-client';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '../src/store/equation';
import {
  UndefinedInlineTooltipContent,
  UndefinedHistoryTooltipContent,
} from '../src/components/UndefinedWarning';

const renderWithEquation = (ui: React.ReactElement, eqStr: string) => {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation(eqStr), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return render(<Provider store={store}>{ui}</Provider>);
};

describe('UndefinedWarning tooltips (#416) — inline and history diverge', () => {
  test('inline tooltip previews the offending subtree and never says "branch"', () => {
    // The offending `/0` subtree of `x/0 = 5` is at `lhs`.
    renderWithEquation(<UndefinedInlineTooltipContent path="lhs" />, 'x/0 = 5');

    // It renders the specific sub-expression as a preview, not just prose.
    expect(screen.getByTestId('undefined-subtree-preview')).toBeInTheDocument();
    // "branch" is meaningless for a sub-expression — it must not appear here.
    expect(document.body.textContent ?? '').not.toMatch(/branch/i);
    // Still names the condition.
    expect(screen.getByText(/division by zero/i)).toBeInTheDocument();
  });

  test('history tooltip is generic — no subtree preview, and may speak of a "branch"', () => {
    render(<UndefinedHistoryTooltipContent />);

    // No per-subtree preview: the history node speaks about the whole equation.
    expect(screen.queryByTestId('undefined-subtree-preview')).toBeNull();
    // The history IS a tree, so "branch" is the right word here.
    expect(screen.getByText(/branch/i)).toBeInTheDocument();
    expect(screen.getByText(/division by zero/i)).toBeInTheDocument();
  });
});
