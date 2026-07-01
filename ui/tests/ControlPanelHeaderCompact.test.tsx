// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ControlPanel } from '@/components/ControlPanel';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '@/store/equation';
import { parseEquation } from 'math-engine-client';
import { SHORT_SCREEN_QUERY } from '@/hooks/useIsShortScreen';

/**
 * On short (mobile-landscape) viewports the History header's generous spacing
 * eats scarce vertical space (#325); compact it there so the tree gets the room.
 */
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

function installMatchMedia(short: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === SHORT_SCREEN_QUERY ? short : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

function headerOf() {
  return screen.getByRole('heading', { name: /history/i }).closest('.border-b') as HTMLElement;
}

describe('ControlPanel header compaction (#325)', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
    cleanup();
  });

  it('uses roomy header spacing on a normal viewport', () => {
    installMatchMedia(false);
    render(<Provider store={makeStore()}><ControlPanel /></Provider>);
    expect(headerOf().className).toContain('pb-4');
  });

  it('compacts the header on a short viewport', () => {
    installMatchMedia(true);
    render(<Provider store={makeStore()}><ControlPanel /></Provider>);
    const header = headerOf();
    expect(header.className).toContain('pb-2');
    expect(header.className).not.toContain('pb-4');
  });
});
