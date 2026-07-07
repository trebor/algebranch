// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { parseEquation } from 'math-engine';
import {
  reduciblePathsAtom,
  filteredReduciblePathsAtom,
  rawSettingsAtom,
  DEFAULT_SETTINGS,
  type ReducibleActionInfo,
} from '@/store/equation';

const decimalAction = (): ReducibleActionInfo => ({
  equation: parseEquation('x = 0.75'),
  type: 'reduce',
  label: 'Evaluate to Decimal',
});

const simplifyAction = (): ReducibleActionInfo => ({
  equation: parseEquation('x = 3/4'),
  type: 'reduce',
  label: 'Simplify',
});

// #363: the classroom-sensible baseline is exact-preferred, so the default now
// suppresses the "Evaluate to Decimal" move rather than offering it. The gate
// mechanism itself predates this (#67); this file pins the flipped default and
// re-confirms the gate still filters as expected around it.
describe('allowEvaluateToDecimal gate on the "Evaluate to Decimal" move', () => {
  it('defaults to exact-preferred (decimal off)', () => {
    expect(DEFAULT_SETTINGS.allowEvaluateToDecimal).toBe(false);
  });

  it('keeps the move when allowEvaluateToDecimal is on', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowEvaluateToDecimal: true });
    store.set(reduciblePathsAtom, { rhs: [decimalAction(), simplifyAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs.map((a) => a.label)).toEqual(['Evaluate to Decimal', 'Simplify']);
  });

  it('drops the move under the default, leaving other moves intact', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS });
    store.set(reduciblePathsAtom, { rhs: [decimalAction(), simplifyAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs.map((a) => a.label)).toEqual(['Simplify']);
  });

  it('removes a path entirely when the only move there was Evaluate to Decimal', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS });
    store.set(reduciblePathsAtom, { rhs: [decimalAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs).toBeUndefined();
  });
});
