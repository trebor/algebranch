// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { HintDrawer } from '../src/components/HintDrawer';
import { hintActiveAtom, hintLevelAtom } from '../src/store/hint';
import { resetToEquationStringAtom } from '../src/store/equation';

describe('HintDrawer Component', () => {
  it('renders nothing when hint active is false', () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <HintDrawer />
      </Provider>
    );
    expect(screen.queryByRole('complementary', { name: /Hint Ladder Guidance/i })).toBeNull();
  });

  it('renders strategic hint when hint mode is active', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);

    render(
      <Provider store={store}>
        <HintDrawer />
      </Provider>
    );

    expect(screen.getByRole('complementary', { name: /Hint Ladder Guidance/i })).toBeTruthy();
    expect(screen.getAllByText(/Move numbers to the right side/i).length).toBeGreaterThan(0);
  });

  it('advances hint level when Next Hint button is clicked', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);

    render(
      <Provider store={store}>
        <HintDrawer />
      </Provider>
    );

    expect(screen.getByText(/Hint 1 of 3/i)).toBeTruthy();

    const nextBtn = screen.getByRole('button', { name: /Next Hint/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Hint 2 of 3/i)).toBeTruthy();
    expect(store.get(hintLevelAtom)).toBe(2);
  });
});
