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
  targetPathsAtom,
  sourcePathAtom,
  hoverPathAtom,
  hoverReducePathAtom,
  hoverReduceIndexAtom,
  isTreeAnimatingAtom,
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

// A multi-option reduce handle on the same candidate. Its accessible name is the
// family label "Simplify" (#456) — distinct from every option-row label ("Simplify
// Alpha"/"Beta"), so a peek-tooltip assertion can't be confused for an open menu row.
function makeMultiHandleStore() {
  const store = makeStore();
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=4'), type: 'reduce', label: 'Simplify Alpha' },
      { equation: parseEquation('x=-4'), type: 'reduce', label: 'Simplify Beta' },
    ] as never,
  });
  return store;
}

// `x + 3 = 7` with `3` (lhs/1) already picked as the source and `rhs` a valid
// move target — the state in which a target node offers its "Preview Move".
function makeTargetStore() {
  const store = makeStore();
  store.set(sourcePathAtom, 'lhs/1');
  store.set(targetPathsAtom, { rhs: parseEquation('x = 7 - 3') } as never);
  return store;
}

const renderPath = (store: ReturnType<typeof createStore>, p: string) =>
  render(
    <Provider store={store}>
      <RovingTabindexProvider>
        <div role="tree" aria-label="Equation">
          <EquationNode path={p} />
        </div>
      </RovingTabindexProvider>
    </Provider>,
  );

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
  it('a long-press on a candidate reveals the peek tooltip without selecting it', async () => {
    installMatchMedia(false); // phone: no hover
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    // Finger down, held still — no move. After the long-press delay the peek shows.
    pointer(term, 'pointerdown', 100, 100);

    // The peek preview appears (real timers: the ~500ms hold elapses). On touch the
    // label coaches the follow-up gesture — "Tap to select", not "Select Term".
    expect(await screen.findByText('Tap to select', undefined, { timeout: 2000 })).toBeInTheDocument();
    // A peek must never select the term.
    expect(store.get(sourcePathAtom)).toBeNull();
  });

  it('lifting the finger ends the peek (tooltip disappears)', async () => {
    installMatchMedia(false);
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    await screen.findByText('Tap to select', undefined, { timeout: 2000 });

    pointer(term, 'pointerup', 100, 100);
    await waitFor(() => expect(screen.queryByText('Tap to select')).not.toBeInTheDocument());
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
    expect(screen.queryByText('Tap to select')).not.toBeInTheDocument();
  });

  it('a long-press does not select even when the release fires a trailing click', async () => {
    installMatchMedia(false);
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    pointer(term, 'pointerdown', 100, 100);
    await screen.findByText('Tap to select', undefined, { timeout: 2000 });
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
    expect(screen.queryByText('Tap to select')).not.toBeInTheDocument();
  });

  it('lifting the finger after a touch press clears the hover highlight (returns to neutral)', () => {
    installMatchMedia(false);
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    // A tap synthesizes a mouseenter (which sets hoverPath) but never the matching
    // mouseleave, so without an explicit reset the node stays the sole highlighted
    // term after release — a "semi-selected" limbo. The lift must return the board
    // to neutral: nothing hovered, every candidate offered again (#388).
    fireEvent.mouseEnter(term);
    pointer(term, 'pointerdown', 100, 100);
    expect(store.get(hoverPathAtom)).toBe('lhs/1');

    pointer(term, 'pointerup', 100, 100);
    expect(store.get(hoverPathAtom)).toBeNull();
  });
});

describe('EquationNode touch target move-preview peek (#388)', () => {
  it('a long-press on a target reveals a "Tap to move" peek without applying the move', async () => {
    installMatchMedia(false); // phone: no hover
    const store = makeTargetStore();
    const { container } = renderPath(store, 'rhs');
    const target = nodeAt(container, 'rhs');

    pointer(target, 'pointerdown', 100, 100);

    // The move preview appears; on touch it coaches the follow-up tap.
    expect(await screen.findByText('Tap to move', undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText('Preview Move')).not.toBeInTheDocument();

    // The release commonly emits a trailing click; a peek is "show me," never
    // "do it" — the move must not apply, so the source stays selected.
    pointer(target, 'pointerup', 100, 100);
    fireEvent.click(target);
    expect(store.get(sourcePathAtom)).toBe('lhs/1');
  });

  it('lifting the finger dismisses the target peek', async () => {
    installMatchMedia(false);
    const store = makeTargetStore();
    const { container } = renderPath(store, 'rhs');
    const target = nodeAt(container, 'rhs');

    pointer(target, 'pointerdown', 100, 100);
    await screen.findByText('Tap to move', undefined, { timeout: 2000 });

    pointer(target, 'pointerup', 100, 100);
    await waitFor(() => expect(screen.queryByText('Tap to move')).not.toBeInTheDocument());
  });

  it('desktop hover on a target still reveals "Preview Move"', async () => {
    installMatchMedia(true); // hover-capable
    const store = makeTargetStore();
    const { container } = renderPath(store, 'rhs');
    const target = nodeAt(container, 'rhs');

    fireEvent.mouseEnter(target);

    expect(await screen.findByText('Preview Move', undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText('Tap to move')).not.toBeInTheDocument();
  });
});

describe('EquationNode touch handle chooser (#388)', () => {
  it('a tap opens the handle menu and it STAYS open (hover-open does not toggle it shut)', () => {
    installMatchMedia(false); // phone: no hover
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

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
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.mouseEnter(handle);
    fireEvent.click(handle, { detail: 1 });
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    fireEvent.click(handle, { detail: 1 });
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('closing the menu with a second tap returns the node to the neutral state (#388)', () => {
    installMatchMedia(false);
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    // A tap opens the menu; on touch the synthesized mouseenter also highlights
    // the node (hoverPath = its path). jsdom doesn't synthesize that enter, so
    // model the highlight the tap leaves behind directly.
    fireEvent.click(handle, { detail: 1 });
    act(() => store.set(hoverPathAtom, 'lhs/1'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    // A second tap on the same handle dismisses the menu. Touch has no
    // hover-leave, so without an explicit reset the node stays stranded in the
    // semi-selected highlight — closing must return to nothing-highlighted.
    fireEvent.click(handle, { detail: 1 });
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(store.get(hoverPathAtom)).toBeNull();
  });

  it('dismissing the menu by tapping outside also clears the touch highlight (#388)', () => {
    installMatchMedia(false);
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    // Open the menu; model the highlight the tap's synthesized mouseenter leaves.
    fireEvent.click(handle, { detail: 1 });
    act(() => store.set(hoverPathAtom, 'lhs/1'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    // Tapping anywhere outside the menu and its handle dismisses it — and must
    // likewise return the node to neutral, not just the handle re-tap path.
    act(() => pointer(document.body, 'pointerdown', 5, 5));
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(store.get(hoverPathAtom)).toBeNull();
  });

  it('a handle press that drifts past the drag threshold does NOT select the node', () => {
    installMatchMedia(false);
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

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

describe('EquationNode desktop handle: hover informs, click commits (#456)', () => {
  beforeEach(() => installMatchMedia(true)); // hover-capable

  it('hovering a handle does NOT open the chooser — it reveals the peek tooltip and sets the target highlight', async () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.mouseEnter(handle);

    // Hover no longer spawns the chooser — that is the whole point of #456.
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    // It still highlights which subexpression the handle affects…
    expect(store.get(hoverReducePathAtom)).toBe('lhs/1');
    // …and reveals the purely informational peek tooltip — the operation family
    // name "Simplify" (#456), not the specific option label "Simplify Alpha".
    expect(await screen.findByText('Simplify', undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText('Simplify Alpha')).not.toBeInTheDocument();
  });

  it('leaving the handle clears the target highlight', () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.mouseEnter(handle);
    expect(store.get(hoverReducePathAtom)).toBe('lhs/1');

    fireEvent.mouseLeave(handle);
    expect(store.get(hoverReducePathAtom)).toBeNull();
  });

  it('a click opens the chooser (parity with a touch tap)', () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.click(handle, { detail: 1 });

    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('a re-click toggles the chooser closed', () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.click(handle, { detail: 1 });
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    fireEvent.click(handle, { detail: 1 });
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('the chooser STAYS open when the pointer leaves the handle (no grace-timer close)', () => {
    vi.useFakeTimers();
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.click(handle, { detail: 1 });
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    // The old hover model scheduled a grace-timer close on mouseleave; a
    // click-gated chooser persists until an explicit dismiss — even after any
    // amount of idle time with the pointer away.
    fireEvent.mouseLeave(handle);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('an outside click dismisses the chooser', () => {
    const store = makeHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.click(handle, { detail: 1 });
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    act(() => pointer(document.body, 'pointerdown', 5, 5));
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('suppresses the handle peek tooltip while that handle chooser is open', () => {
    vi.useFakeTimers();
    const store = makeMultiHandleStore();
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.click(handle, { detail: 1 });
    // Menu open → hovering the handle must NOT also reveal its peek tooltip. The
    // peek content is the family name "Simplify"; the open menu's rows read
    // "Simplify Alpha"/"Beta", so an exact-text query catches only the peek.
    fireEvent.mouseEnter(handle);
    act(() => vi.advanceTimersByTime(1000)); // past the show-delay
    expect(screen.queryByText('Simplify')).not.toBeInTheDocument();
  });

  it('suppresses the handle peek tooltip while the tree is animating', () => {
    vi.useFakeTimers();
    const store = makeMultiHandleStore();
    act(() => store.set(isTreeAnimatingAtom, true));
    renderLhs(store);
    const handle = screen.getByRole('button', { name: 'Simplify' });

    fireEvent.mouseEnter(handle);
    // Advance well past the tooltip show-delay; a mid-slide peek stays suppressed.
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Simplify')).not.toBeInTheDocument();
  });

  it('hover still reveals the Select-Term tooltip on a candidate node', async () => {
    const store = makeStore();
    const { container } = renderLhs(store);
    const term = nodeAt(container, 'lhs/1');

    fireEvent.mouseEnter(term);

    // The controlled Select-Term tooltip is a node affordance, untouched by #456.
    expect(await screen.findByText('Select Term', undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});

// A tap applies (unchanged); a long-press *reads* a row into the preview pane
// without applying — completing the read/act symmetry of #455 inside the chooser,
// so touch users no longer choose blind against a hover-only preview.
describe('EquationNode chooser option-row long-press preview (#457)', () => {
  // currentNodeId leaves '0' only when an option's onApply runs (pushEquation
  // advances the history head) — the definitive "did it apply?" signal, immune to
  // the menu also closing on plain dismiss.
  const currentNodeId = (store: ReturnType<typeof createStore>) =>
    (store.get(rawTabsAtom)[0] as WorkspaceTab).currentNodeId;

  const openMultiMenu = () => {
    const store = makeMultiHandleStore();
    renderLhs(store);
    fireEvent.click(screen.getByRole('button', { name: 'Simplify' }), { detail: 1 });
    return store;
  };

  it('a long-press on an option row previews it in the pane without applying', () => {
    vi.useFakeTimers();
    installMatchMedia(false); // phone: no hover
    const store = openMultiMenu();

    // Before any read the pane sits on its placeholder — nothing definite shown.
    expect(screen.getByText(/hold an option to preview/i)).toBeInTheDocument();

    const beta = screen.getByRole('menuitem', { name: /Simplify Beta/ });
    pointer(beta, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(600)); // past the ~500ms long-press hold

    // Placeholder gone → the pane now shows a definite preview…
    expect(screen.queryByText(/an option to preview/i)).not.toBeInTheDocument();
    // …targeting Beta specifically (row index 1 of the reduce stack)…
    expect(store.get(hoverReducePathAtom)).toBe('lhs/1');
    expect(store.get(hoverReduceIndexAtom)).toBe(1);
    // …and it applied nothing: menu still open, history head unmoved.
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(currentNodeId(store)).toBe('0');
  });

  it('releasing the finger keeps the preview showing and still applies nothing', () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    const store = openMultiMenu();

    const beta = screen.getByRole('menuitem', { name: /Simplify Beta/ });
    pointer(beta, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(600));
    pointer(beta, 'pointerup', 100, 100);

    // The preview persists after lift so the user can read it, then decide.
    expect(screen.queryByText(/an option to preview/i)).not.toBeInTheDocument();
    expect(currentNodeId(store)).toBe('0');
  });

  it('swallows the long-press trailing click so a read never applies', () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    const store = openMultiMenu();

    const beta = screen.getByRole('menuitem', { name: /Simplify Beta/ });
    pointer(beta, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(600));
    pointer(beta, 'pointerup', 100, 100);
    // A long-press commonly emits a trailing click on release; it must be swallowed
    // so the read does not double as an apply.
    fireEvent.click(beta, { detail: 1 });

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(currentNodeId(store)).toBe('0');
  });

  it('a fresh tap after reading applies the row and closes the menu', () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    const store = openMultiMenu();

    // Read Beta (long-press), lift, and swallow the read's trailing click.
    const beta = screen.getByRole('menuitem', { name: /Simplify Beta/ });
    pointer(beta, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(600));
    pointer(beta, 'pointerup', 100, 100);
    fireEvent.click(beta, { detail: 1 });
    expect(currentNodeId(store)).toBe('0'); // still just read, not applied

    // Now a fresh, deliberate tap (a quick press/lift, no hold) acts.
    pointer(beta, 'pointerdown', 100, 100);
    act(() => vi.advanceTimersByTime(50)); // lifts well before the long-press fires
    pointer(beta, 'pointerup', 100, 100);
    fireEvent.click(beta, { detail: 1 });

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(currentNodeId(store)).not.toBe('0');
  });

  it('a plain tap with no hold still applies immediately (tap-acts survives)', () => {
    installMatchMedia(false);
    const store = openMultiMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Simplify Alpha/ }), { detail: 1 });

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(currentNodeId(store)).not.toBe('0');
  });

  it('a press that drifts past the threshold cancels — no preview fires', () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    const store = openMultiMenu();

    const beta = screen.getByRole('menuitem', { name: /Simplify Beta/ });
    pointer(beta, 'pointerdown', 100, 100);
    pointer(beta, 'pointermove', 140, 100); // ~40px, past the 24px threshold
    act(() => vi.advanceTimersByTime(600));

    // A drift is a scroll, not a hold: the placeholder stays, nothing applied.
    expect(screen.getByText(/hold an option to preview/i)).toBeInTheDocument();
    expect(currentNodeId(store)).toBe('0');
  });

  it('placeholder copy is device-aware: "Hold…" on touch', () => {
    installMatchMedia(false);
    openMultiMenu();
    expect(screen.getByText(/hold an option to preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/hover an option to preview/i)).not.toBeInTheDocument();
  });

  it('placeholder copy is device-aware: "Hover…" on a hover device', () => {
    installMatchMedia(true);
    openMultiMenu();
    expect(screen.getByText(/hover an option to preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/hold an option to preview/i)).not.toBeInTheDocument();
  });
});
