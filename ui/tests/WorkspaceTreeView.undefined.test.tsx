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

function makeStore(eqStr: string): ReturnType<typeof createStore> {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': {
        id: '0',
        equation: parseEquation(eqStr),
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

describe('WorkspaceTreeView undefined (÷0) state badge (#416)', () => {
  afterEach(cleanup);

  it('flags a division-by-zero state with an undefined badge, consistent with contradiction/identity', () => {
    render(
      <Provider store={makeStore('x/0=5')}>
        <WorkspaceTreeView interactive scrollActiveIntoView={false} />
      </Provider>,
    );
    const badge = screen.getByRole('img', { name: /undefined.*division by zero/i });
    expect(badge).toBeInTheDocument();
  });

  it('does not flag a well-defined equation', () => {
    render(
      <Provider store={makeStore('x=5')}>
        <WorkspaceTreeView interactive scrollActiveIntoView={false} />
      </Provider>,
    );
    expect(screen.queryByRole('img', { name: /division by zero/i })).toBeNull();
  });
});
