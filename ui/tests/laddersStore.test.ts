// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, test, expect, beforeEach } from 'vitest';
import { createStore } from 'jotai';
import {
  practiceSetProgressAtom,
  activePracticeSetAtom,
  startPracticeSetAtom,
  advancePracticeSetAtom,
  exitPracticeSetAtom,
  readyForNextProblemAtom,
  getPracticeSetsFromStorage,
  savePracticeSetsToStorage,
  hydratePracticeSetsAtom,
  PRACTICE_SET_STORAGE_KEY,
} from '../src/store/ladders';
import {
  tabsAtom,
  activeTabIdAtom,
  terminalStatusAtom,
} from '../src/store/equation';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { safeStorage, __resetMemoryStore } from '../src/utils/safeStorage';

describe('Practice Set Store (ladders.ts)', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    safeStorage.removeItem(PRACTICE_SET_STORAGE_KEY);
    __resetMemoryStore();
    store = createStore();
  });

  test('starting a practice set sets activeSetId, position 0, and opens preset', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });
    const active = store.get(activePracticeSetAtom);
    expect(active).not.toBeNull();
    expect(active?.set.id).toBe('linear_basics');
    expect(active?.position).toBe(0);

    // Verify equation loaded into active tab
    const tabs = store.get(tabsAtom);
    const activeId = store.get(activeTabIdAtom);
    const activeTab = tabs.find((t) => t.id === activeId);
    expect(activeTab?.name).toBe('Basic Linear Equation');
  });

  test('advancing a practice set moves position forward and loads next equation', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });
    store.set(advancePracticeSetAtom);

    const active = store.get(activePracticeSetAtom);
    expect(active?.position).toBe(1);

    const tabs = store.get(tabsAtom);
    const activeId = store.get(activeTabIdAtom);
    const activeTab = tabs.find((t) => t.id === activeId);
    expect(activeTab?.name).toBe('Negative Coefficients');
  });

  test('advancing past last problem marks set completed', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics', position: 4 });
    store.set(advancePracticeSetAtom);

    const progress = store.get(practiceSetProgressAtom);
    expect(progress.completedSetIds).toContain('linear_basics');
  });

  test('exitPracticeSet clears activeSetId', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });
    expect(store.get(activePracticeSetAtom)).not.toBeNull();

    store.set(exitPracticeSetAtom);
    expect(store.get(activePracticeSetAtom)).toBeNull();
  });

  test('localStorage persistence round-trips state', () => {
    const initialState = {
      activeSetId: 'identities_factoring',
      position: 2,
      completedSetIds: ['linear_basics'],
      setPositions: { identities_factoring: 2, linear_basics: 4 },
    };
    savePracticeSetsToStorage(initialState);
    const loaded = getPracticeSetsFromStorage();
    expect(loaded).toEqual(initialState);
  });

  test('hydratePracticeSetsAtom loads from local storage', () => {
    const persistedState = {
      activeSetId: 'powers_roots',
      position: 1,
      completedSetIds: ['linear_basics'],
      setPositions: { powers_roots: 1, linear_basics: 4 },
    };
    savePracticeSetsToStorage(persistedState);
    store.set(hydratePracticeSetsAtom);
    expect(store.get(practiceSetProgressAtom)).toEqual(persistedState);
  });

  describe('readyForNextProblemAtom', () => {
    test('returns false when no practice set is active', () => {
      store.set(exitPracticeSetAtom);
      expect(store.get(readyForNextProblemAtom)).toBe(false);
    });

    test('returns false mid-derivation (un-isolated equation)', () => {
      store.set(startPracticeSetAtom, { setId: 'linear_basics' });
      // Current equation is 2 * x + 4 = 10
      expect(store.get(readyForNextProblemAtom)).toBe(false);
    });

    test('returns true when current equation is a solved form (constant RHS)', () => {
      store.set(startPracticeSetAtom, { setId: 'linear_basics' });

      // Update current equation node to solved form x = 3
      const tabs = store.get(tabsAtom);
      const activeId = store.get(activeTabIdAtom);
      const solvedEq = ensureNodeIds(parseEquation('x = 3'));

      const updatedTabs = tabs.map((t) =>
        t.id === activeId
          ? {
              ...t,
              historyTree: {
                ...t.historyTree,
                [t.currentNodeId]: {
                  ...t.historyTree[t.currentNodeId],
                  equation: solvedEq,
                },
              },
            }
          : t
      );
      store.set(tabsAtom, updatedTabs);

      expect(store.get(readyForNextProblemAtom)).toBe(true);
    });

    test('returns true when terminalStatusAtom is non-null (contradiction / identity)', () => {
      store.set(startPracticeSetAtom, { setId: 'linear_basics' });
      expect(store.get(readyForNextProblemAtom)).toBe(false);

      store.set(terminalStatusAtom, 'contradiction');
      expect(store.get(readyForNextProblemAtom)).toBe(true);

      store.set(terminalStatusAtom, 'identity');
      expect(store.get(readyForNextProblemAtom)).toBe(true);
    });
  });
});
