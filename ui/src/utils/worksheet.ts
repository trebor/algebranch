// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { Equation } from 'math-engine-client';
import type { DerivationStep } from '../store/equation';

export interface WorksheetLines {
  problem: Equation | null;
  blankCount: number;
}

/**
 * Pure helper that maps the derivation steps payload to a problem statement
 * and the count of blanks needed to represent the remaining steps.
 */
export const worksheetLines = (steps: readonly DerivationStep[]): WorksheetLines => {
  if (steps.length === 0) {
    return { problem: null, blankCount: 0 };
  }
  return {
    problem: steps[0].equation,
    blankCount: steps.length - 1,
  };
};
