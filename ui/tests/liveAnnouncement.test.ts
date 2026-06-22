// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  pushEquationAtom,
  liveAnnouncementAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeStore(eqText: string) {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation(eqText), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('liveAnnouncementAtom — screen-reader narration of applied transforms', () => {
  it('narrates the new equation when a step is pushed', () => {
    const store = makeStore('x=1');
    store.set(pushEquationAtom, parseEquation('x=2'));
    expect(store.get(liveAnnouncementAtom)).toContain('x = 2');
  });

  it('includes the step label when one is given', () => {
    const store = makeStore('x=1');
    store.set(pushEquationAtom, parseEquation('x=2'), 'Simplify');
    const msg = store.get(liveAnnouncementAtom);
    expect(msg).toContain('Simplify');
    expect(msg).toContain('x = 2');
  });
});
