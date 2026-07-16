// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { revealReducer, initialRevealState } from '../src/utils/revealState';

describe('revealReducer', () => {
  it('initializes to 1 by default', () => {
    const state = initialRevealState();
    expect(state.revealedCount).toBe(1);
  });

  it('can advance up to max', () => {
    let state = initialRevealState(1);
    state = revealReducer(state, { type: 'ADVANCE', max: 3 });
    expect(state.revealedCount).toBe(2);

    state = revealReducer(state, { type: 'ADVANCE', max: 3 });
    expect(state.revealedCount).toBe(3);

    // Stays clamped to max
    state = revealReducer(state, { type: 'ADVANCE', max: 3 });
    expect(state.revealedCount).toBe(3);
  });

  it('can retreat down to 1', () => {
    let state = initialRevealState(3);
    state = revealReducer(state, { type: 'RETREAT' });
    expect(state.revealedCount).toBe(2);

    state = revealReducer(state, { type: 'RETREAT' });
    expect(state.revealedCount).toBe(1);

    // Stays clamped to 1
    state = revealReducer(state, { type: 'RETREAT' });
    expect(state.revealedCount).toBe(1);
  });

  it('can reset to a specific count', () => {
    let state = initialRevealState(3);
    state = revealReducer(state, { type: 'RESET', count: 1 });
    expect(state.revealedCount).toBe(1);
  });
});
