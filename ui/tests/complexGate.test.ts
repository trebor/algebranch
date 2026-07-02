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

const extendAction = (): ReducibleActionInfo => ({
  equation: parseEquation('x = sqrt(4) * ⅈ'),
  type: 'reduce',
  label: 'Extend to ℂ',
});

const simplifyAction = (): ReducibleActionInfo => ({
  equation: parseEquation('x = 2'),
  type: 'reduce',
  label: 'Simplify',
});

// The complexAllowed gate (#105) hides the "extend to ℂ" doorway when a class is
// kept real-numbers-only — mirroring how allowEvaluateToDecimal hides the
// decimal move.
describe('allowComplex gate on the "Extend to ℂ" move', () => {
  it('defaults to allowing complex', () => {
    expect(DEFAULT_SETTINGS.allowComplex).toBe(true);
  });

  it('keeps the move when allowComplex is on', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowComplex: true });
    store.set(reduciblePathsAtom, { rhs: [extendAction(), simplifyAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs.map((a) => a.label)).toEqual(['Extend to ℂ', 'Simplify']);
  });

  it('drops the move when allowComplex is off, leaving other moves intact', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowComplex: false });
    store.set(reduciblePathsAtom, { rhs: [extendAction(), simplifyAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs.map((a) => a.label)).toEqual(['Simplify']);
  });

  it('removes a path entirely when the only move there was Extend to ℂ', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowComplex: false });
    store.set(reduciblePathsAtom, { rhs: [extendAction()] });
    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered.rhs).toBeUndefined();
  });
});
