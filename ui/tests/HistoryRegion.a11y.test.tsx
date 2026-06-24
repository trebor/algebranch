// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ControlPanel } from '@/components/ControlPanel';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('History region landmark (#257, PR A; #237)', () => {
  afterEach(cleanup);

  it('wraps the history in a complementary landmark labelled by the History heading', () => {
    render(<Provider store={makeStore()}><ControlPanel /></Provider>);
    // <aside> (complementary) labelled via aria-labelledby at the existing
    // <h2>History</h2>, so a screen-reader rotor lists it as the "History"
    // sidebar landmark — symmetric with the left "Equation library" aside (#237).
    expect(screen.getByRole('complementary', { name: /history/i })).toBeInTheDocument();
  });

  it('exposes a focusable skip-link target id only when regionId is provided', () => {
    const { unmount } = render(
      <Provider store={makeStore()}><ControlPanel regionId="history-region" /></Provider>,
    );
    const region = document.getElementById('history-region');
    expect(region).not.toBeNull();
    expect(region?.tagName).toBe('ASIDE');
    // tabIndex=-1 lets the skip link land focus here without adding a Tab stop.
    expect(region).toHaveAttribute('tabindex', '-1');
    unmount();

    // The second (mobile bottom-sheet) instance omits regionId to avoid a
    // duplicate id; it still gets the landmark role but no skip-target id.
    render(<Provider store={makeStore()}><ControlPanel /></Provider>);
    expect(document.getElementById('history-region')).toBeNull();
  });
});
