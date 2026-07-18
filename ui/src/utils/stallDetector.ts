// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

export interface StallDetectorState {
  readonly lastInteractionTime: number;
  readonly isTermSelected: boolean;
  readonly hasFired: boolean;
  readonly moveCount: number;
}

export type StallEvent =
  | { kind: 'select'; timestamp: number }
  | { kind: 'deselect'; timestamp: number }
  | { kind: 'move'; timestamp: number }
  | { kind: 'open-handle'; timestamp: number }
  | { kind: 'tick'; timestamp: number }
  | { kind: 'state-change'; timestamp: number; moveCount: number };

export const DEFAULT_STALL_TIMEOUT_MS = 30000;

export const initialStallState = (timestamp: number, moveCount: number): StallDetectorState => {
  return {
    lastInteractionTime: timestamp,
    isTermSelected: false,
    hasFired: false,
    moveCount,
  };
};

type EventHandlers = {
  readonly [K in StallEvent['kind']]: (
    state: StallDetectorState,
    event: Extract<StallEvent, { kind: K }>,
    timeoutMs: number,
  ) => { nextState: StallDetectorState; fireStall: 'selected-no-move' | 'idle-after-move' | null };
};

const EVENT_HANDLERS: EventHandlers = {
  'state-change': (_state, event) => ({
    nextState: {
      lastInteractionTime: event.timestamp,
      isTermSelected: false,
      hasFired: false,
      moveCount: event.moveCount,
    },
    fireStall: null,
  }),
  'select': (state, event) => ({
    nextState: {
      ...state,
      lastInteractionTime: event.timestamp,
      isTermSelected: true,
    },
    fireStall: null,
  }),
  'deselect': (state, event) => ({
    nextState: {
      ...state,
      lastInteractionTime: event.timestamp,
      isTermSelected: false,
    },
    fireStall: null,
  }),
  'open-handle': (state, event) => ({
    nextState: {
      ...state,
      lastInteractionTime: event.timestamp,
    },
    fireStall: null,
  }),
  'move': (state, event) => ({
    nextState: {
      ...state,
      lastInteractionTime: event.timestamp,
    },
    fireStall: null,
  }),
  'tick': (state, event, timeoutMs) => {
    if (state.hasFired) {
      return { nextState: state, fireStall: null };
    }

    const elapsed = event.timestamp - state.lastInteractionTime;
    if (elapsed >= timeoutMs) {
      if (state.isTermSelected) {
        return {
          nextState: {
            ...state,
            hasFired: true,
          },
          fireStall: 'selected-no-move',
        };
      }
      if (state.moveCount >= 1) {
        return {
          nextState: {
            ...state,
            hasFired: true,
          },
          fireStall: 'idle-after-move',
        };
      }
    }

    return { nextState: state, fireStall: null };
  },
};

/**
 * Updates the stall detector state based on a new interaction or tick event.
 */
export const updateStallDetector = (
  state: StallDetectorState,
  event: StallEvent,
  timeoutMs: number = DEFAULT_STALL_TIMEOUT_MS,
): { nextState: StallDetectorState; fireStall: 'selected-no-move' | 'idle-after-move' | null } => {
  const kind = event.kind;
  if (kind === 'state-change') {
    return EVENT_HANDLERS['state-change'](state, event as Extract<StallEvent, { kind: 'state-change' }>, timeoutMs);
  }
  if (kind === 'select') {
    return EVENT_HANDLERS['select'](state, event as Extract<StallEvent, { kind: 'select' }>, timeoutMs);
  }
  if (kind === 'deselect') {
    return EVENT_HANDLERS['deselect'](state, event as Extract<StallEvent, { kind: 'deselect' }>, timeoutMs);
  }
  if (kind === 'open-handle') {
    return EVENT_HANDLERS['open-handle'](state, event as Extract<StallEvent, { kind: 'open-handle' }>, timeoutMs);
  }
  if (kind === 'move') {
    return EVENT_HANDLERS['move'](state, event as Extract<StallEvent, { kind: 'move' }>, timeoutMs);
  }
  if (kind === 'tick') {
    return EVENT_HANDLERS['tick'](state, event as Extract<StallEvent, { kind: 'tick' }>, timeoutMs);
  }
  return { nextState: state, fireStall: null };
};
