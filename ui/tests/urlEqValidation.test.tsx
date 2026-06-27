// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import Home from '@/app/page';
import { equationInputModalOpenAtom, equationEditSeedAtom, toastAtom } from '@/store/equation';

describe('Home Page URL Equation parameter validation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('handles a valid equation parameter correctly on load', async () => {
    window.history.replaceState(null, '', '/?eq=x%20%3D%202');

    const store = createStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(store.get(equationInputModalOpenAtom)).toBe(false);
    expect(store.get(equationEditSeedAtom)).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('opens input modal with edit seed when eq parameter is invalid', async () => {
    window.history.replaceState(null, '', '/?eq=x');

    const store = createStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(store.get(equationInputModalOpenAtom)).toBe(true);
    expect(store.get(equationEditSeedAtom)).toEqual({ lhs: 'x', relation: '=', rhs: '' });
    expect(store.get(toastAtom)?.message).toBe('Invalid shared equation format');
    expect(window.location.search).toBe('');
  });
});
