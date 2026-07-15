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
  hydrateWorkspaceTabsAtom,
  safeLocalStorage,
} from '@/store/equation';

const mockReduceAction = (label = 'Simplify'): ReducibleActionInfo => ({
  equation: parseEquation('x = 2'),
  type: 'reduce',
  label,
});

const mockFactorAction = (label = 'Factor'): ReducibleActionInfo => ({
  equation: parseEquation('x = x*(x-1)'),
  type: 'factor',
  label,
});



describe('progressiveMode gate on reducible actions', () => {
  it('defaults to false', () => {
    expect(DEFAULT_SETTINGS.progressiveMode).toBe(false);
  });

  it('keeps all actions when progressiveMode is off', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, progressiveMode: false });
    
    const paths = {
      'rhs': [mockReduceAction('Root Simplify')],
      'rhs/args/0': [mockReduceAction('Inner Simplify')],
    };
    store.set(reduciblePathsAtom, paths);

    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered['rhs']).toBeDefined();
    expect(filtered['rhs/args/0']).toBeDefined();
    expect(filtered['rhs'].map(a => a.label)).toEqual(['Root Simplify']);
    expect(filtered['rhs/args/0'].map(a => a.label)).toEqual(['Inner Simplify']);
  });

  it('suppresses parent reduce actions when a child reduce action exists', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, progressiveMode: true });

    const paths = {
      'rhs': [mockReduceAction('Root Simplify')],
      'rhs/args/0': [mockReduceAction('Inner Simplify')],
    };
    store.set(reduciblePathsAtom, paths);

    const filtered = store.get(filteredReduciblePathsAtom);
    // Root Simplify is suppressed because 'rhs/args/0' starts with 'rhs/' and contains a reduce action
    expect(filtered['rhs']).toBeUndefined();
    expect(filtered['rhs/args/0']).toBeDefined();
    expect(filtered['rhs/args/0'].map(a => a.label)).toEqual(['Inner Simplify']);
  });

  it('keeps non-reduce actions at parent path even if child reduce action exists', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, progressiveMode: true });

    const paths = {
      'rhs': [mockReduceAction('Root Simplify'), mockFactorAction('Complete the Square')],
      'rhs/args/0': [mockReduceAction('Inner Simplify')],
    };
    store.set(reduciblePathsAtom, paths);

    const filtered = store.get(filteredReduciblePathsAtom);
    // Root Simplify is suppressed, but Complete the Square (factor type) survives
    expect(filtered['rhs']).toBeDefined();
    expect(filtered['rhs'].map(a => a.label)).toEqual(['Complete the Square']);
    expect(filtered['rhs/args/0'].map(a => a.label)).toEqual(['Inner Simplify']);
  });

  it('does not suppress parent reduce when child reduce is independently label-suppressed', () => {
    const store = createStore();
    // evaluateToDecimal is off by default. A child decimal evaluation should not block parent reduce.
    store.set(rawSettingsAtom, {
      ...DEFAULT_SETTINGS,
      progressiveMode: true,
      allowEvaluateToDecimal: false,
    });

    const paths = {
      'rhs': [mockReduceAction('Root Simplify')],
      'rhs/args/0': [mockReduceAction('Evaluate to Decimal')],
    };
    store.set(reduciblePathsAtom, paths);

    const filtered = store.get(filteredReduciblePathsAtom);
    // Since 'Evaluate to Decimal' is filtered out by allowEvaluateToDecimal: false,
    // the child path has no surviving reduce actions. Thus, Root Simplify survives!
    expect(filtered['rhs']).toBeDefined();
    expect(filtered['rhs'].map(a => a.label)).toEqual(['Root Simplify']);
    expect(filtered['rhs/args/0']).toBeUndefined();
  });

  it('drops a path entirely if all its actions are suppressed', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, progressiveMode: true });

    const paths = {
      'rhs': [mockReduceAction('Root Simplify')],
      'rhs/args/0': [mockReduceAction('Inner Simplify')],
    };
    store.set(reduciblePathsAtom, paths);

    const filtered = store.get(filteredReduciblePathsAtom);
    expect(filtered['rhs']).toBeUndefined();
  });

  it('hydrates settings properly and merges progressiveMode with default false', () => {
    const store = createStore();
    // Simulate hydrating settings with no progressiveMode key (representing an old saved settings payload)
    const oldSettings = {
      allowEvaluateToDecimal: true,
      allowComplex: false,
      seenEqualsHint: true,
      chromeScale: 1.2,
      animationSpeed: 1.0,
    };
    
    safeLocalStorage.setItem('algebranch_settings', JSON.stringify(oldSettings));
    try {
      store.set(hydrateWorkspaceTabsAtom);
    } finally {
      safeLocalStorage.removeItem('algebranch_settings');
    }

    const settings = store.get(rawSettingsAtom);
    expect(settings.allowEvaluateToDecimal).toBe(true);
    expect(settings.allowComplex).toBe(false);
    expect(settings.progressiveMode).toBe(false); // defaulted!
  });
});
