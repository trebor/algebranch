// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { EquationInputModal } from '@/components/EquationInputModal';
import { equationInputModalOpenAtom } from '@/store/equation';

describe('EquationInputModal', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the relation operator select dropdown when open', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const select = screen.getByRole('combobox', { name: /relation operator/i }) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('=');
  });

  it('renders the chevron down handle inside the wrapper and does not render a pulsing badge', () => {
    const store = createStore();
    store.set(equationInputModalOpenAtom, true);
    render(
      <Provider store={store}>
        <EquationInputModal />
      </Provider>
    );

    const select = screen.getByRole('combobox', { name: /relation operator/i });
    const wrapper = select.parentElement;
    expect(wrapper).toBeTruthy();

    // Assert the chevron SVG icon is present in the wrapper
    const svg = wrapper!.querySelector('svg');
    expect(svg).toBeTruthy();

    // Assert there is no pulsing badge (no .animate-pulse element inside the wrapper)
    const badge = wrapper!.querySelector('.animate-pulse');
    expect(badge).toBeNull();
  });
});
