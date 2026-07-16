// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

export interface RevealState {
  readonly revealedCount: number;
}

export type RevealAction =
  | { readonly type: 'ADVANCE'; readonly max: number }
  | { readonly type: 'RETREAT' }
  | { readonly type: 'RESET'; readonly count: number };

export const initialRevealState = (count = 1): RevealState => ({
  revealedCount: count,
});

export const revealReducer = (state: RevealState, action: RevealAction): RevealState => {
  switch (action.type) {
    case 'ADVANCE':
      return { revealedCount: Math.min(state.revealedCount + 1, action.max) };
    case 'RETREAT':
      return { revealedCount: Math.max(state.revealedCount - 1, 1) };
    case 'RESET':
      return { revealedCount: action.count };
    default:
      return state;
  }
};
