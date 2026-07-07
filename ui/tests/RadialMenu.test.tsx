// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import React, { useRef } from 'react';
import { RadialMenu } from '@/components/RadialMenu';
import { radialMenuOpenAtom, radialInitialActionAtom } from '@/store/equation';

// matchMedia stand-in: jsdom ships none. Answer `(hover: hover)` from the
// `canHover` flag so a test can model a phone (canHover=false) vs a desktop
// (canHover=true, the no-matchMedia default). Mirrors the touch-interaction suite.
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

function RadialMenuHarness() {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={anchor} id="equals-anchor" style={{ width: '20px', height: '20px' }}>=</div>
      <RadialMenu anchorRef={anchor} />
    </div>
  );
}

const originalMatchMedia = window.matchMedia;

describe('RadialMenu touch tooltip suppression (#388)', () => {
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  // On touch there is no hover, but the focus trap auto-focuses the first petal
  // (swap) on open, and <Tooltip> shows on `onFocus` as well as hover. That made
  // the "Swap left and right sides" tip auto-pop from a single tap on the `=`.
  // Its owner must pass visible={false} on touch so neither focus nor synthesized
  // hover can reveal it.
  it('does NOT auto-show the swap petal tooltip on a touch (no-hover) device', async () => {
    installMatchMedia(false); // phone: no hover
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>,
    );

    // The petal button (aria-label) is present, but its tooltip text — rendered
    // by HotkeyHint inside the <Tooltip> popover — must never appear.
    expect(screen.getByRole('button', { name: /Swap left and right sides/i })).toBeTruthy();
    // Past the tooltip show-delay window, the tooltip text is still absent.
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Swap left and right sides')).toBeNull();
  });

  // Desktop keeps the hover/focus-driven tooltip so the guard can't over-suppress.
  it('still shows the swap petal tooltip on focus on a hover-capable device', async () => {
    installMatchMedia(true); // desktop: hover-capable
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>,
    );

    // The swap petal is auto-focused by the trap; its tooltip appears after the delay.
    await waitFor(() => expect(screen.getByText('Swap left and right sides')).toBeInTheDocument());
  });

  // Long-press on a petal must not select the glyph text (÷, +, ×, …).
  it('marks petals unselectable so a long-press cannot select the glyph', () => {
    installMatchMedia(false);
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>,
    );
    const petal = screen.getByRole('button', { name: /Swap left and right sides/i });
    expect(petal.className).toContain('select-none');
  });
});

describe('RadialMenu Focus Trap', () => {
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  it('renders nothing when closed', () => {
    const store = createStore();
    store.set(radialMenuOpenAtom, false);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    // No buttons/dialog should be rendered in the document
    const dialog = screen.queryByRole('dialog');
    expect(dialog).toBeNull();
  });

  it('renders and moves focus into the menu when opened', async () => {
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    const dialog = screen.getByRole('dialog', { name: /equals operations menu/i });
    expect(dialog).toBeTruthy();

    // The first petal is "Swap left and right sides" (↔)
    const firstPetal = screen.getByRole('button', { name: /Swap left and right sides/i });
    expect(firstPetal).toHaveFocus();
  });

  it('traps focus among the petals', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    const petals = screen.getAllByRole('button');
    // Ensure there are multiple petals rendering
    expect(petals.length).toBeGreaterThan(1);

    const first = petals[0];
    const last = petals[petals.length - 1];

    // Focus last petal, then tab
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    // Shift+Tab from first should wrap to last
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('traps focus within the term input form when an operation is selected', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    // Click the "Add term to both sides" (+) petal
    const addPetal = screen.getByRole('button', { name: /Add term to both sides/i });
    await user.click(addPetal);

    // The form input field should now be rendered and automatically focused
    const input = screen.getByPlaceholderText('e.g. 5x');
    expect(input).toHaveFocus();

    // Check the other focusable controls inside the form: the imaginary-unit
    // insert button (#105), the Apply button, and the Back to menu button.
    const insertImaginaryBtn = screen.getByRole('button', { name: /insert imaginary unit/i });
    const applyBtn = screen.getByRole('button', { name: /Apply/i });
    const backBtn = screen.getByRole('button', { name: /Back to menu/i });

    // Focus transitions: Input -> ⅈ -> Apply -> Back to menu -> Input
    await user.tab();
    expect(insertImaginaryBtn).toHaveFocus();

    await user.tab();
    expect(applyBtn).toHaveFocus();

    await user.tab();
    expect(backBtn).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    // Shift+Tab wrap-around: Input -> Back to menu -> Apply -> ⅈ -> Input
    await user.tab({ shift: true });
    expect(backBtn).toHaveFocus();
  });

  it('opens straight into the term input when armed with an initial op (hotkey path)', async () => {
    const store = createStore();
    store.set(radialInitialActionAtom, 'add');
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    // The term input is shown directly — no petal click needed — and focused.
    const input = screen.getByPlaceholderText('e.g. 5x');
    expect(input).toHaveFocus();
    // The petal ring is bypassed.
    expect(screen.queryByRole('button', { name: /Swap left and right sides/i })).toBeNull();
    // The intent atom is consumed so a later bare-= open returns to the ring.
    expect(store.get(radialInitialActionAtom)).toBeNull();
  });

  it('opens straight into the spinner when armed with power (hotkey path)', async () => {
    const store = createStore();
    store.set(radialInitialActionAtom, 'power');
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    const increaseBtn = screen.getByRole('button', { name: /Increase value/i });
    expect(increaseBtn).toHaveFocus();
    expect(screen.queryByRole('button', { name: /Swap left and right sides/i })).toBeNull();
    expect(store.get(radialInitialActionAtom)).toBeNull();
  });

  it('traps focus within the spinner form when a power operation is selected', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.set(radialMenuOpenAtom, true);
    render(
      <Provider store={store}>
        <RadialMenuHarness />
      </Provider>
    );

    // Click the "Raise both sides to nth power" (xⁿ) petal
    const powerPetal = screen.getByRole('button', { name: /Raise both sides to nth power/i });
    await user.click(powerPetal);

    // The decrease button is disabled (power starts at 2), so the increase button should be focused immediately
    const increaseBtn = screen.getByRole('button', { name: /Increase value/i });
    expect(increaseBtn).toHaveFocus();

    const applyBtn = screen.getByRole('button', { name: /Apply/i });
    const backBtn = screen.getByRole('button', { name: /Back to menu/i });

    // Focus transitions: Increase -> Apply -> Back to menu -> Increase
    await user.tab();
    expect(applyBtn).toHaveFocus();

    await user.tab();
    expect(backBtn).toHaveFocus();

    await user.tab();
    expect(increaseBtn).toHaveFocus();

    // Shift+Tab wrap-around: Increase -> Back to menu
    await user.tab({ shift: true });
    expect(backBtn).toHaveFocus();
  });
});
