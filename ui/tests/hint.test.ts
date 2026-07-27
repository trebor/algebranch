// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { createStore } from 'jotai';
import {
  hintActiveAtom,
  hintLevelAtom,
  hintDrawerExpandedAtom,
  toggleHintActiveAtom,
  nextHintTierAtom,
  hintLadderAtom,
  hintSpotlightPathAtom,
  isHintableAtom,
} from '../src/store/hint';
import { resetToEquationStringAtom, addTabAtom, toastAtom } from '../src/store/equation';

describe('Hint Store Atoms', () => {
  it('initializes with hint mode inactive and level 1', () => {
    const store = createStore();
    expect(store.get(hintActiveAtom)).toBe(false);
    expect(store.get(hintLevelAtom)).toBe(1);
    expect(store.get(hintDrawerExpandedAtom)).toBe(false);
  });

  it('toggles hint mode active and resets level', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(toggleHintActiveAtom);
    expect(store.get(hintActiveAtom)).toBe(true);
    expect(store.get(hintLevelAtom)).toBe(1);

    store.set(nextHintTierAtom);
    expect(store.get(hintLevelAtom)).toBe(2);

    store.set(hintActiveAtom, false);
    expect(store.get(hintActiveAtom)).toBe(false);
    expect(store.get(hintLevelAtom)).toBe(1);
  });


  it('computes derived hint ladder for current equation', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);

    const ladder = store.get(hintLadderAtom);
    expect(ladder).not.toBeNull();
    expect(ladder?.strategicGoal).toContain('Move numbers');
  });

  it('returns spotlight path when active and level >= 2', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);

    expect(store.get(hintSpotlightPathAtom)).toBeNull();

    store.set(hintLevelAtom, 2);
    expect(store.get(hintSpotlightPathAtom)).not.toBeNull();
  });

  it('deactivates hint when active tab changes', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);
    expect(store.get(hintActiveAtom)).toBe(true);

    // Switch to a new tab via addTabAtom
    store.set(addTabAtom);
    expect(store.get(hintActiveAtom)).toBe(false);
  });

  it('deactivates hint when resetting to a new equation', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, '2*x + 5 = 15');
    store.set(hintActiveAtom, true);
    expect(store.get(hintActiveAtom)).toBe(true);

    // Resetting to another equation string creates/switches tab or equation
    store.set(resetToEquationStringAtom, '3*y = 12');
    expect(store.get(hintActiveAtom)).toBe(false);
  });

  it('disables hints and emits toast for multi-variable equation a^2 + b^2 = c^2', () => {
    const store = createStore();
    store.set(resetToEquationStringAtom, 'a^2 + b^2 = c^2');
    expect(store.get(isHintableAtom)).toBe(false);

    store.set(toggleHintActiveAtom);
    expect(store.get(hintActiveAtom)).toBe(false);
    expect(store.get(toastAtom)?.message).toContain('single-variable equations');
  });
});
