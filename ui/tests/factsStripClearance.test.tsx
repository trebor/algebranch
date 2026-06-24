// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { parseEquation } from 'math-engine';
import { FactsStrip } from '@/components/FactsStrip';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  graphSizeAtom,
  type WorkspaceTab,
} from '@/store/equation';

// Single-source-of-truth guard for the bottom-nav clearance (#251). The nav
// overlap is reserved ONCE on the workspace-column wrapper via
// `--bottom-nav-clearance`; the downstream elements (canvas, FactsStrip, graph
// panel) must no longer re-reserve it with a hardcoded `3.5rem`, which diverged
// from the 2.75rem compacted nav on short screens and caused the margin to
// "balloon". The *feel* (consistent gap, optical centering) is verified by
// screenshots, not unit tests, per the AGENTS visual-tweak carve-out.

const makeTabWithEq = (id: string, name: string, eqStr: string): WorkspaceTab => ({
  id,
  name,
  historyTree: {
    '0': { id: '0', equation: parseEquation(eqStr), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  isCustomNamed: true,
  timestamp: 1,
});

describe('bottom-nav clearance is single-sourced (#251)', () => {
  afterEach(cleanup);

  it('FactsStrip does not hardcode the 3.5rem nav clearance', () => {
    const store = createStore();
    // Tab A uses y; tab B isolates y → one applicable fact, so the strip renders.
    store.set(rawTabsAtom, [
      makeTabWithEq('a', 'A', 'x + y = 10'),
      makeTabWithEq('b', 'B', 'y = 2 * x'),
    ]);
    store.set(rawActiveTabIdAtom, 'a');
    store.set(graphSizeAtom, 'hidden');

    const { container } = render(
      <Provider store={store}>
        <FactsStrip />
      </Provider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).not.toContain('3.5rem');
  });

  it('page.tsx graph panel does not hardcode the 3.5rem nav clearance', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');
    expect(src).not.toContain('3.5rem+env(safe-area-inset-bottom)');
  });

  it('globals.css short-screen canvas override does not re-reserve the nav clearance', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    // The override must not add --bottom-nav-height to its padding-bottom; the
    // wrapper owns that now via --bottom-nav-clearance.
    const overrideBlock = src.slice(src.indexOf('.active-workspace-canvas'));
    const firstRule = overrideBlock.slice(0, overrideBlock.indexOf('}'));
    expect(firstRule).not.toContain('--bottom-nav-height');
  });
});
