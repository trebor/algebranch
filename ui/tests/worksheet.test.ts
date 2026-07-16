// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { parseEquation } from 'math-engine-client';
import { worksheetLines } from '../src/utils/worksheet';
import type { DerivationStep } from '../src/store/equation';

describe('worksheetLines', () => {
  it('handles empty-derivation case', () => {
    const result = worksheetLines([]);
    expect(result).toEqual({ problem: null, blankCount: 0 });
  });

  it('handles single-step derivation', () => {
    const steps: DerivationStep[] = [
      { index: 1, equation: parseEquation('x + 2 = 5') }
    ];
    const result = worksheetLines(steps);
    expect(result.problem).not.toBeNull();
    expect(result.problem?.relation).toBe('=');
    expect(result.blankCount).toBe(0);
  });

  it('handles normal derivation (multiple steps)', () => {
    const steps: DerivationStep[] = [
      { index: 1, equation: parseEquation('x + 2 = 5') },
      { index: 2, equation: parseEquation('x = 5 - 2'), justification: 'Subtract 2 from both sides' },
      { index: 3, equation: parseEquation('x = 3'), justification: 'Simplify' }
    ];
    const result = worksheetLines(steps);
    expect(result.problem).not.toBeNull();
    expect(result.blankCount).toBe(2);
  });
});
