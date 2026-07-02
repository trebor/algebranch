// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  dragNudgeAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// `x + 3 = 7`; the constant `3` (lhs/1) is a movable candidate, the variable `x`
// (lhs/0) is left static for the negative case.
function makeStore() {
  const store = createStore();
  const eq = parseEquation('x + 3 = 7');
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: { '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 } },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  store.set(candidatePathsAtom, new Set(['lhs/1']));
  return store;
}

const renderLhs = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <RovingTabindexProvider>
        <div role="tree" aria-label="Equation">
          <EquationNode path="lhs" />
        </div>
      </RovingTabindexProvider>
    </Provider>,
  );

const nodeAt = (container: HTMLElement, path: string) =>
  container.querySelector(`[data-node-path="${path}"]`) as Element;

// jsdom's PointerEvent constructor drops clientX/clientY from its init (they come
// back `undefined`), which would defeat the movement measurement. A MouseEvent
// typed as a pointer event carries the coords and still fires React's
// onPointerDown/Move/Up delegated listeners — real browsers populate coords natively.
const pointer = (
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) => fireEvent(el, new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

afterEach(cleanup);

describe('EquationNode drag-nudge detection (#386)', () => {
  it('a press-and-move past the threshold on a candidate term triggers the nudge mid-drag', () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    // The nudge fires on the move that crosses the threshold, before pointerup.
    pointer(term, 'pointerdown', 100, 100);
    pointer(term, 'pointermove', 160, 100);

    expect(store.get(dragNudgeAtom)).toEqual({ path: 'lhs/1' });
  });

  it('a small jitter under the threshold does NOT trigger the nudge', () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    pointer(term, 'pointermove', 108, 104); // ~9px — well under the medium threshold
    pointer(term, 'pointerup', 108, 104);

    expect(store.get(dragNudgeAtom)).toBeNull();
  });

  it('stops the pointerdown from bubbling to ancestors, so an ancestor never captures the gesture', () => {
    // Real pointer capture is browser-only (jsdom has none), so we can't reproduce
    // the ancestor-steal directly. But its fix is observable: arming the deepest
    // candidate calls stopPropagation() on the pointerdown, which halts native
    // bubbling before it reaches ancestors — exactly what stops a candidate
    // ancestor from also arming and capturing. A document-level listener is the
    // proxy for "an ancestor saw it". (#386)
    const store = makeStore(); // lhs/1 is the only candidate
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    const ancestorSaw = vi.fn();
    document.addEventListener('pointerdown', ancestorSaw);
    try {
      term.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }),
      );
      expect(ancestorSaw).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('pointerdown', ancestorSaw);
    }
  });

  it('does NOT stop propagation when the press lands on a static term (a candidate ancestor may still claim it)', () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const staticTerm = nodeAt(container, 'lhs/0'); // `x`, not a candidate

    const ancestorSaw = vi.fn();
    document.addEventListener('pointerdown', ancestorSaw);
    try {
      staticTerm.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }),
      );
      expect(ancestorSaw).toHaveBeenCalled();
    } finally {
      document.removeEventListener('pointerdown', ancestorSaw);
    }
  });

  it('a drag that starts on a static (non-candidate) term does NOT trigger', () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const staticTerm = nodeAt(container, 'lhs/0'); // `x`, not in candidatePaths

    pointer(staticTerm, 'pointerdown', 100, 100);
    pointer(staticTerm, 'pointermove', 160, 100);

    expect(store.get(dragNudgeAtom)).toBeNull();
  });
});
