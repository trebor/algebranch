// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { parseEquation, ensureNodeIds, getNodeByPath } from 'math-engine-client';
import { PreviewEquationNode } from '@/components/PreviewEquationNode';
import { EquationPreviewDiffContext } from '@/components/EquationPreviewDiffContext';
import { collectNodeIds } from '@/utils/previewDiff';
import {
  EQUATION_PREVIEW_PALETTE_DARK,
  EQUATION_PREVIEW_PALETTE_DIM,
} from '@/constants/theme';
import { rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '@/store/equation';

// A store with a live equation so the (unused-here) currentEquationAtom resolves.
function makeStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('z=0'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

const idAt = (eq: ReturnType<typeof parseEquation>, path: string) =>
  (getNodeByPath(eq, path) as unknown as { id: string }).id;

describe('preview diff region rule (#423)', () => {
  afterEach(cleanup);

  it('dims only untouched context; a carried leaf under a changed ancestor stays vivid', () => {
    // c + a*b = d, with ONLY the inner `*` (lhs/1) changed. a and b carried their
    // ids but sit inside the changed `*`, so they must read as part of the change.
    const eq = ensureNodeIds(parseEquation('c + a*b = d'));
    const allIds = collectNodeIds(eq);
    const changedStar = idAt(eq, 'lhs/1');
    const carried = new Set([...allIds].filter((id) => id !== changedStar));

    const store = makeStore();
    render(
      <Provider store={store}>
        <EquationPreviewDiffContext.Provider value={carried}>
          <PreviewEquationNode path="lhs" customEquation={eq} />
          <PreviewEquationNode path="rhs" customEquation={eq} />
        </EquationPreviewDiffContext.Provider>
      </Provider>,
    );

    const bright = EQUATION_PREVIEW_PALETTE_DARK.variable;
    const dim = EQUATION_PREVIEW_PALETTE_DIM.variable;

    // a and b: carried ids, but inside the changed `*` → vivid.
    expect(screen.getByText('a').className).toContain(bright);
    expect(screen.getByText('b').className).toContain(bright);
    // c and d: carried and outside any change (untouched context) → dimmed.
    expect(screen.getByText('c').className).toContain(dim);
    expect(screen.getByText('d').className).toContain(dim);
  });

  it('lights the whole subtree when the change is at the region root (y = (x+1)/x)', () => {
    // The entire rhs restructured, so its root `/` is fresh. Even the denominator x,
    // which carried its id from the original 1/x, must brighten because it lives
    // inside the changed fraction — matching the user expectation that the whole
    // transformed node is highlighted.
    const eq = ensureNodeIds(parseEquation('y = (x+1)/x'));
    // Simulate combine-fractions stewardship: the denominator x kept an id present
    // in the "current" equation; everything else in the rhs is fresh.
    const carried = new Set<string>([idAt(eq, 'rhs/1'), idAt(eq, 'lhs')]);

    const store = makeStore();
    render(
      <Provider store={store}>
        <EquationPreviewDiffContext.Provider value={carried}>
          <PreviewEquationNode path="rhs" customEquation={eq} />
        </EquationPreviewDiffContext.Provider>
      </Provider>,
    );

    const bright = EQUATION_PREVIEW_PALETTE_DARK.variable;
    // Both x's (numerator and the carried denominator) are inside the changed `/`.
    const xs = screen.getAllByText('x');
    expect(xs).toHaveLength(2);
    for (const x of xs) expect(x.className).toContain(bright);
  });

  it('marks the changed-region root as the auto-scroll anchor, once, at the boundary', () => {
    // c + a*b = d, only the inner `*` (lhs/1) changed. The scroll anchor is the
    // `*` boundary — not its inner a/b, and not the carried c/d.
    const eq = ensureNodeIds(parseEquation('c + a*b = d'));
    const allIds = collectNodeIds(eq);
    const changedStar = idAt(eq, 'lhs/1');
    const carried = new Set([...allIds].filter((id) => id !== changedStar));

    const store = makeStore();
    const { container } = render(
      <Provider store={store}>
        <EquationPreviewDiffContext.Provider value={carried}>
          <PreviewEquationNode path="lhs" customEquation={eq} />
          <PreviewEquationNode path="rhs" customEquation={eq} />
        </EquationPreviewDiffContext.Provider>
      </Provider>,
    );

    const anchors = container.querySelectorAll('[data-preview-change-root]');
    expect(anchors).toHaveLength(1);
    // The anchor is the whole changed subtree a*b — it contains a and b, not c.
    expect(anchors[0].textContent).toContain('a');
    expect(anchors[0].textContent).toContain('b');
    expect(anchors[0].textContent).not.toContain('c');
  });

  it('marks no anchor outside diff mode', () => {
    const eq = ensureNodeIds(parseEquation('c + a*b = d'));
    const store = makeStore();
    const { container } = render(
      <Provider store={store}>
        <PreviewEquationNode path="lhs" customEquation={eq} />
      </Provider>,
    );
    expect(container.querySelectorAll('[data-preview-change-root]')).toHaveLength(0);
  });
});
