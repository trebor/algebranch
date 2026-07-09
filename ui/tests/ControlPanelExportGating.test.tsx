// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The History header's Copy / Export control acts on the ACTIVE PATH (root →
// current node), so it must gate on that path's length, not the total node count.
// A branched or multi-step tree can be viewed from its root, where the active
// derivation is a single step and there is nothing to copy or export (#130). This
// pins that: selecting the root disables the control even when the tree has many
// nodes, and selecting a deeper node re-enables it.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ControlPanel } from '@/components/ControlPanel';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab, type HistoryNode } from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// A three-node linear derivation: 0 → 1 → 2.
const tree: Record<string, HistoryNode> = {
  '0': { id: '0', equation: parseEquation('2*x=4'), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
  '1': { id: '1', equation: parseEquation('x=4/2'), parentId: '0', childrenIds: ['2'], label: 'Divide by 2', timestamp: 2 },
  '2': { id: '2', equation: parseEquation('x=2'), parentId: '1', childrenIds: [], label: 'Simplify', timestamp: 3 },
};

function makeStore(currentNodeId: string) {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: tree,
    currentNodeId,
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

/** The derivation Copy / Export split-button lives in the History header. */
function headerCopyButton() {
  const header = screen.getByRole('heading', { name: /history/i }).closest('.border-b') as HTMLElement;
  return within(header).getByRole('button', { name: /^copy equation$/i });
}

describe('ControlPanel derivation export gating (#130)', () => {
  let originalMM: typeof window.matchMedia;
  beforeEach(() => {
    originalMM = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
      onchange: null,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = originalMM;
    cleanup();
  });

  it('disables the control at the root, where the active path is a single step', () => {
    render(<Provider store={makeStore('0')}><ControlPanel /></Provider>);
    expect(headerCopyButton()).toBeDisabled();
  });

  it('enables the control at a deeper node, where the active path is a real derivation', () => {
    render(<Provider store={makeStore('2')}><ControlPanel /></Provider>);
    expect(headerCopyButton()).toBeEnabled();
  });
});
