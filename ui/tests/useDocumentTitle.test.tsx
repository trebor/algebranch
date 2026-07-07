// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { appHydratedAtom, rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '@/store/equation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDocumentTitle } from '@/utils/documentTitle';
import { parseEquation } from 'math-engine-client';

const tab = (id: string, name: string): WorkspaceTab => ({
  id,
  name,
  historyTree: {
    '0': { id: '0', equation: parseEquation('x=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  isCustomNamed: true,
  timestamp: 1,
});

const Probe = () => {
  useDocumentTitle();
  return null;
};

const storeWith = (hydrated: boolean) => {
  const store = createStore();
  store.set(rawTabsAtom, [tab('t1', 'My Workspace')]);
  store.set(rawActiveTabIdAtom, 't1');
  store.set(appHydratedAtom, hydrated);
  return store;
};

describe('useDocumentTitle — hydration-gated (#449)', () => {
  beforeEach(() => {
    document.title = 'INITIAL';
  });
  afterEach(cleanup);

  it('leaves the SSR title alone until the app has hydrated (no placeholder flash)', () => {
    render(<Provider store={storeWith(false)}><Probe /></Provider>);
    expect(document.title).toBe('INITIAL');
  });

  it('sets the title to the active workspace once hydrated', () => {
    render(<Provider store={storeWith(true)}><Probe /></Provider>);
    expect(document.title).toBe(formatDocumentTitle('My Workspace'));
  });

  it('updates the title when hydration flips true after mount', () => {
    const store = storeWith(false);
    render(<Provider store={store}><Probe /></Provider>);
    expect(document.title).toBe('INITIAL');

    act(() => {
      store.set(appHydratedAtom, true);
    });
    expect(document.title).toBe(formatDocumentTitle('My Workspace'));
  });
});
