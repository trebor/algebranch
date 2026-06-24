// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationNode } from '@/components/EquationNode';
import { RovingTabindexProvider } from '@/hooks/useRovingTabindex';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  candidatePathsAtom,
  reduciblePathsAtom,
  type WorkspaceTab,
} from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeStore(eqText: string, candidates: string[], reducible?: Record<string, string>) {
  const store = createStore();
  const eq = parseEquation(eqText);
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: eq, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  store.set(candidatePathsAtom, new Set(candidates));
  if (reducible) {
    const map: Record<string, { equation: ReturnType<typeof parseEquation>; type: 'reduce'; label: string }[]> = {};
    for (const [path, resultEq] of Object.entries(reducible)) {
      map[path] = [{ equation: parseEquation(resultEq), type: 'reduce', label: 'Simplify' }];
    }
    store.set(reduciblePathsAtom, map);
  }
  return store;
}

// All natively-tabbable elements in the widget: roving items expose tabIndex 0
// when active and -1 otherwise, so a single Tab stop means exactly one element
// here. A handle <button> with no tabindex would be natively tabbable and leak a
// second stop — that's the regression these assert against.
const tabbableCount = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"], button')).filter((el) => {
    const ti = el.getAttribute('tabindex');
    // A button with no explicit tabindex is natively tabbable.
    return ti === '0' || (ti === null && el.tagName === 'BUTTON');
  }).length;

function renderTree(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <RovingTabindexProvider>
        <div role="tree" aria-label="Equation">
          <EquationNode path="lhs" />
          <EquationNode path="rhs" />
        </div>
      </RovingTabindexProvider>
    </Provider>,
  );
}

// Variant that wires a real container ref to the role="tree" element, so the
// roving controller's `focusContainer()` (Escape "release" exit) has a target —
// mirroring the page, where the tree div is the container Escape can release to.
function ContainerTree({ store }: { store: ReturnType<typeof createStore> }) {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <Provider store={store}>
      <RovingTabindexProvider containerRef={ref}>
        <div role="tree" aria-label="Equation" tabIndex={-1} ref={ref}>
          <EquationNode path="lhs" />
          <EquationNode path="rhs" />
        </div>
      </RovingTabindexProvider>
    </Provider>
  );
}

const tabbable = () => screen.getAllByRole('treeitem').map((el) => el.getAttribute('tabindex'));

describe('EquationNode roving navigation (#257, PR B)', () => {
  afterEach(cleanup);

  it('makes the expression a single Tab stop — exactly one treeitem is tabbable', () => {
    // x^2 - 9 = 0 → three sibling candidates: x^2 (lhs/0), 9 (lhs/1), 0 (rhs).
    const store = makeStore('x^2-9=0', ['lhs/0', 'lhs/1', 'rhs']);
    renderTree(store);
    expect(tabbable().filter((t) => t === '0')).toHaveLength(1);
    // The first in document order is the active one.
    expect(screen.getAllByRole('treeitem')[0]).toHaveAttribute('tabindex', '0');
  });

  it('moves the active term left/right in document order with arrow keys', () => {
    const store = makeStore('x^2-9=0', ['lhs/0', 'lhs/1', 'rhs']);
    renderTree(store);
    const items = screen.getAllByRole('treeitem');
    act(() => items[0].focus());

    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('treeitem')[1]).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(screen.getAllByRole('treeitem')[1]);

    fireEvent.keyDown(screen.getAllByRole('treeitem')[1], { key: 'ArrowLeft' });
    expect(screen.getAllByRole('treeitem')[0]).toHaveAttribute('tabindex', '0');
  });

  it('jumps to first/last with Home/End', () => {
    const store = makeStore('x^2-9=0', ['lhs/0', 'lhs/1', 'rhs']);
    renderTree(store);
    const items = screen.getAllByRole('treeitem');
    act(() => items[0].focus());

    fireEvent.keyDown(items[0], { key: 'End' });
    expect(screen.getAllByRole('treeitem')[2]).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(screen.getAllByRole('treeitem')[2], { key: 'Home' });
    expect(screen.getAllByRole('treeitem')[0]).toHaveAttribute('tabindex', '0');
  });

  it('moves to a descendant candidate with ArrowDown and back up with ArrowUp', () => {
    // The whole LHS (lhs) and the nested constant 9 (lhs/1) are both actionable.
    const store = makeStore('x^2-9=0', ['lhs', 'lhs/1']);
    renderTree(store);
    // Document order: the outer lhs treeitem wraps the inner lhs/1 treeitem.
    const outer = screen.getAllByRole('treeitem')[0];
    act(() => outer.focus());

    fireEvent.keyDown(outer, { key: 'ArrowDown' });
    // The inner descendant becomes active.
    const inner = screen.getAllByRole('treeitem')[1];
    expect(inner).toHaveAttribute('tabindex', '0');
    expect(outer).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(inner, { key: 'ArrowUp' });
    expect(screen.getAllByRole('treeitem')[0]).toHaveAttribute('tabindex', '0');
  });

  it('folds a term handle into the single Tab stop (handle is not its own stop)', () => {
    // The constant 9 (lhs/1) is a candidate AND carries a Simplify handle.
    const store = makeStore('x^2-9=0', ['lhs/1'], { 'lhs/1': 'x^2=9' });
    const { container } = renderTree(store);

    const handle = screen.getByRole('button', { name: /simplify/i });
    // The whole widget is one Tab stop even with the handle present.
    expect(tabbableCount(container)).toBe(1);
    // The handle itself is rolled out of the native tab order.
    expect(handle).toHaveAttribute('tabindex', '-1');
  });

  it('reaches a term handle by arrowing right from the term', () => {
    const store = makeStore('x^2-9=0', ['lhs/1'], { 'lhs/1': 'x^2=9' });
    renderTree(store);

    const term = screen.getByRole('treeitem', { name: /select this term/i });
    const handle = screen.getByRole('button', { name: /simplify/i });
    act(() => term.focus());

    // The handle sits just after its term in document order.
    fireEvent.keyDown(term, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(term).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(handle);

    // Arrowing back returns to the term.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(term).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(term);
  });

  it('enters on a candidate term, not a leading handle on a non-candidate node', () => {
    // x^2 (lhs/0) carries a Simplify handle but is NOT a transposition candidate;
    // 9 (lhs/1) IS a candidate. The handle leads in document order, but the single
    // Tab stop must land on the term, with the handle only arrow-reachable (#257).
    const store = makeStore('x^2-9=0', ['lhs/1'], { 'lhs/0': 'x^2=9' });
    renderTree(store);

    const term = screen.getByRole('treeitem', { name: /select this term/i });
    const handle = screen.getByRole('button', { name: /simplify/i });
    expect(term).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('tabindex', '-1');
  });

  it('enters on the term, not a substitute handle, when a fact from another workspace applies', () => {
    // Repro of a real report: a second workspace defining `x = 7` puts a
    // "Substitute x = 7" handle on the x node of `x + 5 = 12`. The substitution is
    // derived live (availableFacts → substitutionPaths), so this exercises the
    // genuine handle, not a hand-set one. The single Tab stop must be the whole
    // left side, with the substitute handle only arrow-reachable (#257).
    const store = createStore();
    const mkTab = (id: string, eqText: string): WorkspaceTab => ({
      id,
      name: eqText,
      historyTree: {
        '0': { id: '0', equation: parseEquation(eqText), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
      },
      currentNodeId: '0',
      isCustomNamed: true,
      timestamp: 1,
    });
    store.set(rawTabsAtom, [mkTab('a', 'x+5=12'), mkTab('b', 'x=7')]);
    store.set(rawActiveTabIdAtom, 'a');
    // The real transposition scan for x+5=12 (computeMathSync) marks these paths.
    store.set(candidatePathsAtom, new Set(['lhs', 'lhs/0', 'lhs/1', 'rhs']));
    renderTree(store);

    const handle = screen.getByRole('button', { name: /substitute x = 7/i });
    // The term aria-label now reads as spoken math (#256): "x plus 5", not "x + 5".
    const lhsTerm = screen.getByRole('treeitem', { name: /^x plus 5, press Enter/i });
    expect(handle).toHaveAttribute('tabindex', '-1');
    expect(lhsTerm).toHaveAttribute('tabindex', '0');
  });

  it('enters on the term, not a substitute handle, when the candidate scan lands after the handle (async load)', () => {
    // The real report: workspace `2*x+1=5` with another workspace `x=2*y` puts a
    // "Substitute x = 2 * y" handle on the x node. The substitution is derived
    // synchronously, but the transposition scan (candidatePaths) is async, so on
    // load only the handle is registered and becomes the lone Tab stop. Once the
    // scan lands, the default must upgrade to the first term — not stay on the
    // handle (#257).
    const store = createStore();
    const mkTab = (id: string, eqText: string): WorkspaceTab => ({
      id,
      name: eqText,
      historyTree: {
        '0': { id: '0', equation: parseEquation(eqText), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
      },
      currentNodeId: '0',
      isCustomNamed: true,
      timestamp: 1,
    });
    store.set(rawTabsAtom, [mkTab('a', '2*x+1=5'), mkTab('b', 'x=2*y')]);
    store.set(rawActiveTabIdAtom, 'a');
    // candidatePaths deliberately NOT set yet — mirrors the async scan not landing
    // until after the synchronous substitution handle has registered.
    renderTree(store);

    // Before the scan, the handle is the only actionable item, so it is the stop.
    expect(screen.getByRole('button', { name: /substitute x = 2/i })).toHaveAttribute('tabindex', '0');

    // The transposition scan lands (real activePaths for 2*x+1=5).
    act(() => store.set(candidatePathsAtom, new Set(['lhs', 'lhs/0', 'lhs/1', 'rhs'])));

    // Re-query after the re-render (the prior nodes are replaced).
    expect(screen.getByRole('treeitem', { name: /^2 times x plus 1, press Enter/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /substitute x = 2/i })).toHaveAttribute('tabindex', '-1');
  });

  it('steps Escape out to the enclosing term, re-speaking it — not ejecting to the top (#271)', () => {
    // The whole LHS (lhs) and the nested constant 9 (lhs/1) are both actionable.
    // Arrowing into the inner term then Escaping must land on the enclosing term —
    // resuming the user's place one level out — rather than releasing to the top.
    const store = makeStore('x^2-9=0', ['lhs', 'lhs/1']);
    renderTree(store);
    const outer = screen.getAllByRole('treeitem')[0];
    act(() => outer.focus());
    fireEvent.keyDown(outer, { key: 'ArrowDown' });
    const inner = screen.getAllByRole('treeitem')[1];
    expect(inner).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(inner);

    fireEvent.keyDown(inner, { key: 'Escape' });
    // Focus steps OUT to the enclosing term, which is re-spoken by landing on it.
    expect(screen.getAllByRole('treeitem')[0]).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(screen.getAllByRole('treeitem')[0]);
  });

  it('releases Escape to the region container only at the top level — no enclosing term (#271)', () => {
    // Three top-level sibling candidates, none nested in another candidate: there
    // is no enclosing term to step out to, so Escape releases to the container.
    const store = makeStore('x^2-9=0', ['lhs/0', 'lhs/1', 'rhs']);
    render(<ContainerTree store={store} />);
    const container = screen.getByRole('tree');
    const first = screen.getAllByRole('treeitem')[0];
    act(() => first.focus());

    fireEvent.keyDown(first, { key: 'Escape' });
    expect(document.activeElement).toBe(container);
  });

  it('makes a handle-only node (not a candidate) a treeitem so its handle stays reachable', () => {
    // lhs/1 carries a handle but is NOT a transposition candidate.
    const store = makeStore('x^2-9=0', [], { 'lhs/1': 'x^2=9' });
    const { container } = renderTree(store);

    const handle = screen.getByRole('button', { name: /simplify/i });
    // The handle is wrapped in a treeitem (keeps role="tree" valid) and is the
    // single Tab stop.
    expect(handle.closest('[role="treeitem"]')).not.toBeNull();
    expect(tabbableCount(container)).toBe(1);
    expect(handle).toHaveAttribute('tabindex', '0');
  });
});
