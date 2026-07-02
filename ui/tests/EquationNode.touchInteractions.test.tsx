// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  reduciblePathsAtom,
  sourcePathAtom,
  dragNudgeAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

// ---------------------------------------------------------------------------
// matchMedia stand-in: jsdom ships none. We answer `(hover: hover)` from the
// `canHover` flag so a test can model a phone (canHover=false) vs a desktop
// (canHover=true, the no-matchMedia default).
// ---------------------------------------------------------------------------
function installMatchMedia(canHover: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('hover: hover') ? canHover : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

// `x + 3 = 7`; `3` (lhs/1) is a movable candidate.
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

// A single-option reduce handle on the candidate `3`, for the tap-to-open tests.
function makeHandleStore() {
  const store = makeStore();
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=4'), type: 'reduce', label: 'Simplify Alpha' },
    ] as never,
  });
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

// jsdom's PointerEvent drops clientX/clientY; a MouseEvent carries the coords and
// still fires React's delegated onPointer* listeners. We additionally stamp
// `pointerType` so the component can tell touch from mouse (real browsers set it
// natively).
const pointer = (
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  pointerType: 'touch' | 'mouse' = 'touch',
) => {
  const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(ev, 'pointerType', { value: pointerType });
  fireEvent(el, ev);
};

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
  vi.useRealTimers();
});

describe('EquationNode touch node long-press peek (#388)', () => {
  it('a long-press on a candidate reveals the Select-Term tooltip without selecting it', async () => {
    installMatchMedia(false); // phone: no hover
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    // Finger down, held still — no move. After the long-press delay the peek shows.
    pointer(term, 'pointerdown', 100, 100);

    // The Select-Term preview appears (real timers: the ~500ms hold elapses).
    expect(await screen.findByText('Select Term', undefined, { timeout: 2000 })).toBeInTheDocument();
    // A peek must never select the term.
    expect(store.get(sourcePathAtom)).toBeNull();
  });

  it('lifting the finger ends the peek (tooltip disappears)', async () => {
    installMatchMedia(false);
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    await screen.findByText('Select Term', undefined, { timeout: 2000 });

    pointer(term, 'pointerup', 100, 100);
    await waitFor(() => expect(screen.queryByText('Select Term')).not.toBeInTheDocument());
  });

  it('a press-and-move is a drag-nudge, not a peek — the tooltip never shows', () => {
    installMatchMedia(false);
    vi.useFakeTimers();
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    // Move past the threshold before the long-press timer would fire.
    pointer(term, 'pointermove', 160, 100);
    // Even after the would-be long-press window elapses, no peek appears…
    act(() => vi.advanceTimersByTime(800));

    // The move routes to the drag-nudge (which selects the source, per #386) and
    // the long-press peek never fires — no Select-Term preview flashes.
    expect(store.get(dragNudgeAtom)).toEqual({ path: 'lhs/1' });
    expect(screen.queryByText('Select Term')).not.toBeInTheDocument();
  });

  it('a long-press does not select even when the release fires a trailing click', async () => {
    installMatchMedia(false);
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    await screen.findByText('Select Term', undefined, { timeout: 2000 });
    pointer(term, 'pointerup', 100, 100);
    // A long-press on touch commonly still emits a click on release; it must be
    // swallowed so the peek never doubles as a selection.
    fireEvent.click(term);

    expect(store.get(sourcePathAtom)).toBeNull();
  });

  it('a plain tap still selects on touch (peek is long-press only)', () => {
    installMatchMedia(false);
    vi.useFakeTimers();
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    // Quick down/up well under the long-press delay, then the trailing click.
    pointer(term, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(120));
    pointer(term, 'pointerup', 100, 100);
    fireEvent.click(term);

    expect(store.get(sourcePathAtom)).toBe('lhs/1');
    expect(screen.queryByText('Select Term')).not.toBeInTheDocument();
  });
});

describe('EquationNode touch handle chooser (#388)', () => {
  it('a tap opens the handle menu and it STAYS open (hover-open does not toggle it shut)', () => {
    installMatchMedia(false); // phone: no hover
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });

    // Real touch synthesizes BOTH a mouseenter and a click. With hover-open live
    // (the old behavior) the mouseenter opens and the click toggles it shut. On a
    // no-hover device the mouseenter must be inert, so the tap leaves it open.
    fireEvent.mouseEnter(handle);
    fireEvent.click(handle, { detail: 1 });

    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('a second tap on the handle closes the menu', () => {
    installMatchMedia(false);
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });

    fireEvent.mouseEnter(handle);
    fireEvent.click(handle, { detail: 1 });
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    fireEvent.click(handle, { detail: 1 });
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('a handle press that drifts past the drag threshold does NOT select the node', () => {
    installMatchMedia(false);
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });

    // The handle hangs off a movable candidate. A finger pressing a small handle
    // drifts a few pixels; that press must stay the handle's own gesture and never
    // arm the node's drag-nudge — otherwise the drift selects the node underneath,
    // leaving it stuck-selected after the menu closes (#388).
    pointer(handle, 'pointerdown', 100, 100);
    pointer(handle, 'pointermove', 140, 100); // ~40px, well past the 24px threshold
    pointer(handle, 'pointerup', 140, 100);
    fireEvent.click(handle, { detail: 1 });

    expect(store.get(sourcePathAtom)).toBeNull();
    // …and the tap still opens the chooser.
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });
});

describe('EquationNode desktop hover is unchanged (#388)', () => {
  beforeEach(() => installMatchMedia(true)); // hover-capable

  it('hover still opens the handle menu on a hover-capable device', () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });

    fireEvent.mouseEnter(handle);

    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('hover still reveals the Select-Term tooltip on a candidate node', async () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    fireEvent.mouseEnter(term);

    // The controlled Select-Term tooltip must still appear on desktop hover — the
    // regression that briefly hid every node tooltip lived here (#388).
    expect(await screen.findByText('Select Term', undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});
