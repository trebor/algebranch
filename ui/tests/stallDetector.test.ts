// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import {
  initialStallState,
  updateStallDetector,
} from '@/utils/stallDetector';

describe('stall detector', () => {
  it('initializes correctly', () => {
    const state = initialStallState(1000, 2);
    expect(state.lastInteractionTime).toBe(1000);
    expect(state.isTermSelected).toBe(false);
    expect(state.hasFired).toBe(false);
    expect(state.moveCount).toBe(2);
  });

  it('triggers selected-no-move after N seconds of term selection', () => {
    let state = initialStallState(0, 0);

    // Select a term at t=5000
    let result = updateStallDetector(state, { kind: 'select', timestamp: 5000 });
    state = result.nextState;
    expect(state.lastInteractionTime).toBe(5000);
    expect(state.isTermSelected).toBe(true);
    expect(result.fireStall).toBeNull();

    // Tick before timeout (e.g. t=34000, elapsed 29000ms)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 34000 });
    state = result.nextState;
    expect(result.fireStall).toBeNull();
    expect(state.hasFired).toBe(false);

    // Tick exactly at timeout (t=35000, elapsed 30000ms)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 35000 });
    state = result.nextState;
    expect(result.fireStall).toBe('selected-no-move');
    expect(state.hasFired).toBe(true);

    // Subsequent tick should not fire again
    result = updateStallDetector(state, { kind: 'tick', timestamp: 36000 });
    expect(result.fireStall).toBeNull();
    expect(result.nextState.hasFired).toBe(true);
  });

  it('triggers idle-after-move after N seconds if moveCount >= 1 and no term is selected', () => {
    let state = initialStallState(0, 1);

    // Tick before timeout (e.g. t=29000)
    let result = updateStallDetector(state, { kind: 'tick', timestamp: 29000 });
    state = result.nextState;
    expect(result.fireStall).toBeNull();

    // Tick at timeout (t=30000)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 30000 });
    state = result.nextState;
    expect(result.fireStall).toBe('idle-after-move');
    expect(state.hasFired).toBe(true);
  });

  it('does not trigger idle-after-move if moveCount === 0', () => {
    const state = initialStallState(0, 0);

    // Tick at timeout (t=30000)
    const result = updateStallDetector(state, { kind: 'tick', timestamp: 30000 });
    expect(result.fireStall).toBeNull();
    expect(result.nextState.hasFired).toBe(false);
  });

  it('does not trigger if user deselects before the timeout', () => {
    let state = initialStallState(0, 0);

    // Select at t=1000
    state = updateStallDetector(state, { kind: 'select', timestamp: 1000 }).nextState;

    // Deselect at t=20000 (resets lastInteractionTime and sets isTermSelected to false)
    let result = updateStallDetector(state, { kind: 'deselect', timestamp: 20000 });
    state = result.nextState;
    expect(state.lastInteractionTime).toBe(20000);
    expect(state.isTermSelected).toBe(false);

    // Tick at t=31000 (30000ms after select, but only 11000ms after deselect)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 31000 });
    state = result.nextState;
    expect(result.fireStall).toBeNull();

    // Tick at t=50000 (30000ms after deselect). Since moveCount is 0, nothing should fire.
    result = updateStallDetector(state, { kind: 'tick', timestamp: 50000 });
    expect(result.fireStall).toBeNull();
  });

  it('resets the timer on intermediate interactions', () => {
    let state = initialStallState(0, 0);

    // Select at t=1000
    state = updateStallDetector(state, { kind: 'select', timestamp: 1000 }).nextState;

    // Open handle at t=20000 (an interaction, resets timer)
    let result = updateStallDetector(state, { kind: 'open-handle', timestamp: 20000 });
    state = result.nextState;
    expect(state.lastInteractionTime).toBe(20000);
    expect(state.isTermSelected).toBe(true);

    // Tick at t=31000 (elapsed since last interaction is 11000ms)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 31000 });
    state = result.nextState;
    expect(result.fireStall).toBeNull();

    // Tick at t=50000 (elapsed is 30000ms)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 50000 });
    expect(result.fireStall).toBe('selected-no-move');
  });

  it('handles state changes correctly (re-enabling fire and setting new moveCount)', () => {
    let state = initialStallState(0, 0);

    // Select at t=1000 and let it fire
    state = updateStallDetector(state, { kind: 'select', timestamp: 1000 }).nextState;
    let result = updateStallDetector(state, { kind: 'tick', timestamp: 31000 });
    state = result.nextState;
    expect(result.fireStall).toBe('selected-no-move');
    expect(state.hasFired).toBe(true);

    // State changes at t=40000 (moveCount becomes 1, hasFired resets to false)
    result = updateStallDetector(state, { kind: 'state-change', timestamp: 40000, moveCount: 1 });
    state = result.nextState;
    expect(state.lastInteractionTime).toBe(40000);
    expect(state.isTermSelected).toBe(false);
    expect(state.hasFired).toBe(false);
    expect(state.moveCount).toBe(1);

    // Tick at t=70000 (30000ms later, should fire idle-after-move)
    result = updateStallDetector(state, { kind: 'tick', timestamp: 70000 });
    expect(result.fireStall).toBe('idle-after-move');
    expect(result.nextState.hasFired).toBe(true);
  });
});
