// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { WorkspaceTreeView } from '@/components/WorkspaceTreeView';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// A single-step derivation whose equation exercises the pretty serializer:
// a radical, a product, and an exponent all of which read poorly as ASCII.
function makeStore(): ReturnType<typeof createStore> {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': {
        id: '0',
        equation: parseEquation('sqrt(4*9)+x^2=12'),
        parentId: null,
        childrenIds: [],
        label: 'Initial',
        timestamp: 1,
      },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('WorkspaceTreeView card label formatting', () => {
  afterEach(cleanup);

  it('renders the equation as display-ready Unicode, not the raw ASCII string', () => {
    render(
      <Provider store={makeStore()}>
        <WorkspaceTreeView interactive scrollActiveIntoView={false} />
      </Provider>,
    );
    const step = screen.getByRole('treeitem', { name: /step 0/i });
    const text = step.textContent ?? '';
    // Pretty Unicode: real radical and superscript exponent.
    expect(text).toContain('√');
    expect(text).toContain('x²');
    // No ASCII escape hatches leaking through.
    expect(text).not.toContain('sqrt(');
    expect(text).not.toContain('x^2');
  });
});
