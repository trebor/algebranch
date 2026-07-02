// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
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

// A node carrying TWO reduce options on one path → a multi-option handle whose
// click opens the self-contained popover menu (the PR D surface).
function makeMultiOptionStore() {
  const store = createStore();
  const eq = parseEquation('x+8=0');
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
  store.set(candidatePathsAtom, new Set(['lhs/1']));
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=-8'), type: 'reduce', label: 'Simplify Alpha' },
      { equation: parseEquation('x=8'), type: 'reduce', label: 'Simplify Beta' },
    ] as never,
  });
  return store;
}

// A node carrying exactly ONE reduce option on one path → a single-option
// handle. It now opens the same popover menu as a multi-option handle rather
// than applying on click (#369).
function makeSingleOptionStore() {
  const store = createStore();
  const eq = parseEquation('x+8=0');
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
  store.set(candidatePathsAtom, new Set(['lhs/1']));
  store.set(reduciblePathsAtom, {
    'lhs/1': [
      { equation: parseEquation('x=-8'), type: 'reduce', label: 'Simplify Alpha' },
    ] as never,
  });
  return store;
}

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

// A keyboard-activated button click reports detail === 0; a pointer click is >= 1.
// The component keys "move focus into the menu" off that distinction.
const keyboardClick = (el: HTMLElement) => fireEvent.click(el, { detail: 0 });
const mouseClick = (el: HTMLElement) => fireEvent.click(el, { detail: 1 });

describe('multi-option handle menu focus (#257, PR D)', () => {
  afterEach(cleanup);

  it('moves focus to the first menu option when opened via keyboard', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());

    keyboardClick(handle);

    const options = screen.getAllByRole('menuitem');
    expect(options).toHaveLength(2);
    expect(document.activeElement).toBe(options[0]);
  });

  it('does NOT steal focus when opened by hover/mouse', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());

    // Hover-open path: openStackMenu without the keyboard flag.
    fireEvent.mouseEnter(handle);

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    // Focus stays on the handle — a hovering mouse user is not yanked into the menu.
    expect(document.activeElement).toBe(handle);
  });

  it('roves the options with ArrowDown / ArrowUp (wrapping)', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());
    keyboardClick(handle);

    const options = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(options[0]);

    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);

    // Wraps back to the first.
    fireEvent.keyDown(options[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[0]);

    // ArrowUp wraps to the last.
    fireEvent.keyDown(options[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[1]);
  });

  it('jumps to first/last with Home/End', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());
    keyboardClick(handle);

    const options = screen.getAllByRole('menuitem');
    fireEvent.keyDown(options[0], { key: 'End' });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(options[1], { key: 'Home' });
    expect(document.activeElement).toBe(options[0]);
  });

  it('closes on Escape and restores focus to the handle', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());
    keyboardClick(handle);

    const options = screen.getAllByRole('menuitem');
    fireEvent.keyDown(options[0], { key: 'Escape' });

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(document.activeElement).toBe(handle);
  });

  it('applies and closes when an option is activated', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    act(() => handle.focus());
    keyboardClick(handle);

    const beta = screen.getByRole('menuitem', { name: /simplify beta/i });
    fireEvent.click(beta);

    // The menu closes after applying.
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('exposes the option list as a role="menu" with only one tab stop', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    mouseClick(handle);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const options = screen.getAllByRole('menuitem');
    const tabbable = options.filter((o) => o.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  it('keeps the count header for a multi-option menu', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    mouseClick(handle);

    expect(screen.getByText(/simplifications available/i)).toBeInTheDocument();
  });

  it('gives every option row an apply cue so it reads as a button (#369)', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    mouseClick(handle);

    // One trailing "apply" affordance per option row.
    const cues = screen.getAllByTestId('option-apply-cue');
    expect(cues).toHaveLength(2);
  });

  it('renders preview sizers even when no option is hovered (preventing size jumps)', () => {
    const store = makeMultiOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /show simplifications/i });
    mouseClick(handle);

    // Verify the "Hover an option to preview" hint is present
    expect(screen.getByText(/hover an option to preview/i)).toBeInTheDocument();

    // (see the single-option describe block below for its counterpart assertions)

    // Verify that the invisible sizers are present in the DOM to reserve space
    const sizers = screen.getAllByTestId('preview-sizer', { suggest: false }).concat(
      screen.queryAllByText((content, element) => {
        // Guard for string className: SVG elements (e.g. the option apply-cue
        // arrow) expose an SVGAnimatedString, not a string, so .includes would throw.
        return element?.getAttribute('aria-hidden') === 'true' &&
               typeof element?.className === 'string' &&
               element.className.includes('invisible') &&
               (content.includes('-8') || content.includes('8'));
      })
    );
    expect(sizers.length).toBeGreaterThan(0);
  });
});

describe('single-option handle opens the menu too (#369)', () => {
  afterEach(cleanup);

  it('opens the popover menu on click instead of applying immediately', () => {
    const store = makeSingleOptionStore();
    renderTree(store);
    // A single-option handle carries its option label as its accessible name.
    const handle = screen.getByRole('button', { name: /simplify alpha/i });
    expect(handle).toHaveAttribute('aria-haspopup', 'menu');

    mouseClick(handle);

    const options = screen.getAllByRole('menuitem');
    expect(options).toHaveLength(1);
  });

  it('auto-previews the sole option (no "hover to preview" placeholder)', () => {
    const store = makeSingleOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });
    mouseClick(handle);

    // The menu is open...
    expect(screen.getByRole('menu')).toBeInTheDocument();
    // ...and with nothing to disambiguate, the one option is previewed straight
    // away — no "hover to preview" placeholder.
    expect(screen.queryByText(/hover an option to preview/i)).not.toBeInTheDocument();
  });

  it('applies and closes when the sole option is activated', () => {
    const store = makeSingleOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });
    mouseClick(handle);

    fireEvent.click(screen.getByRole('menuitem', { name: /simplify alpha/i }));
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('omits the redundant header for a single-option menu', () => {
    const store = makeSingleOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });
    mouseClick(handle);

    // The row still names the action...
    expect(screen.getByRole('menuitem', { name: /simplify alpha/i })).toBeInTheDocument();
    // ...but the standalone "Simplify" header is gone — it only echoed the row.
    expect(screen.queryByText('Simplify', { exact: true })).not.toBeInTheDocument();
    // ...and the sole row still carries the apply cue.
    expect(screen.getAllByTestId('option-apply-cue')).toHaveLength(1);
  });

  it('opens via keyboard and moves focus to the sole option', () => {
    const store = makeSingleOptionStore();
    renderTree(store);
    const handle = screen.getByRole('button', { name: /simplify alpha/i });
    act(() => handle.focus());

    keyboardClick(handle);

    const options = screen.getAllByRole('menuitem');
    expect(options).toHaveLength(1);
    expect(document.activeElement).toBe(options[0]);
  });
});
