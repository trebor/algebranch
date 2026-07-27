// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { parseEquation } from 'math-engine';
import {
  rawSettingsAtom,
  DEFAULT_SETTINGS,
  toastAtom,
  historyTreeAtom,
  currentNodeIdAtom,
} from '@/store/equation';
import {
  hintActiveAtom,
  toggleHintActiveAtom,
} from '@/store/hint';

describe('allowHints gate in hint store', () => {
  it('defaults allowHints to true', () => {
    expect(DEFAULT_SETTINGS.allowHints).toBe(true);
  });

  it('allows hints when allowHints is true', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowHints: true });
    const eq = parseEquation('2 * x + 4 = 10');
    store.set(historyTreeAtom, {
      '0': { id: '0', parentId: null, equation: eq, label: 'Initial', childrenIds: [], timestamp: Date.now() },
    });
    store.set(currentNodeIdAtom, '0');

    store.set(toggleHintActiveAtom);
    expect(store.get(hintActiveAtom)).toBe(true);
  });

  it('suppresses hints and triggers toast when allowHints is false', () => {
    const store = createStore();
    store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, allowHints: false });
    const eq = parseEquation('2 * x + 4 = 10');
    store.set(historyTreeAtom, {
      '0': { id: '0', parentId: null, equation: eq, label: 'Initial', childrenIds: [], timestamp: Date.now() },
    });
    store.set(currentNodeIdAtom, '0');

    store.set(toggleHintActiveAtom);
    expect(store.get(hintActiveAtom)).toBe(false);

    const toast = store.get(toastAtom);
    expect(toast).not.toBeNull();
    expect(toast?.message).toBe('Hints are disabled in classroom settings');
  });
});
