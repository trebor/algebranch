// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import React, { useRef } from 'react';
import { RadialMenu } from '@/components/RadialMenu';
import { radialMenuOpenAtom, radialInitialActionAtom } from '@/store/equation';

function RadialMenuHarness() {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={anchor} id="equals-anchor" style={{ width: '20px', height: '20px' }}>=</div>
      <RadialMenu anchorRef={anchor} />
    </div>
  );
}

describe('RadialMenu Focus Trap', () => {
  afterEach(() => {
    cleanup();
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

    // Check the other focusable controls inside the form: the Apply button and Back to menu button
    const applyBtn = screen.getByRole('button', { name: /Apply/i });
    const backBtn = screen.getByRole('button', { name: /Back to menu/i });

    // Focus transitions: Input -> Apply -> Back to menu -> Input
    await user.tab();
    expect(applyBtn).toHaveFocus();

    await user.tab();
    expect(backBtn).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    // Shift+Tab wrap-around: Input -> Back to menu -> Apply -> Input
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
