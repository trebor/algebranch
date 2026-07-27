// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { PracticeGoalBanner } from '../src/components/PracticeGoalBanner';
import {
  tabsAtom,
  activeTabIdAtom,
} from '../src/store/equation';
import { startPracticeSetAtom, PRACTICE_SET_STORAGE_KEY } from '../src/store/ladders';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { safeStorage, __resetMemoryStore } from '../src/utils/safeStorage';

describe('PracticeGoalBanner Component', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    safeStorage.removeItem(PRACTICE_SET_STORAGE_KEY);
    __resetMemoryStore();
    store = createStore();
  });

  test('does not render when no practice set is active', () => {
    render(
      <Provider store={store}>
        <PracticeGoalBanner />
      </Provider>
    );

    expect(screen.queryByRole('note', { name: /Goal:/i })).toBeNull();
  });

  test('renders explicit goal message when practice set is active', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });

    render(
      <Provider store={store}>
        <PracticeGoalBanner />
      </Provider>
    );

    const goalNote = screen.getByRole('note', { name: /Goal: Isolate x/i });
    expect(goalNote).toBeInTheDocument();
    expect(goalNote.textContent).toContain('Goal: Isolate x');
  });

  test('interpolates active target variable when equation features a different variable', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });

    // Update active tab equation to feature variable y
    const tabs = store.get(tabsAtom);
    const activeId = store.get(activeTabIdAtom);
    const yEq = ensureNodeIds(parseEquation('3 * y + 5 = 11'));

    const updatedTabs = tabs.map((t) =>
      t.id === activeId
        ? {
            ...t,
            historyTree: {
              ...t.historyTree,
              [t.currentNodeId]: {
                ...t.historyTree[t.currentNodeId],
                equation: yEq,
              },
            },
          }
        : t
    );
    store.set(tabsAtom, updatedTabs);

    render(
      <Provider store={store}>
        <PracticeGoalBanner />
      </Provider>
    );

    const goalNote = screen.getByRole('note', { name: /Goal: Isolate y/i });
    expect(goalNote).toBeInTheDocument();
    expect(goalNote.textContent).toContain('Goal: Isolate y');
  });

  test('renders custom goal template when preset specifies goalTemplate', () => {
    store.set(startPracticeSetAtom, { setId: 'identities_factoring' });

    render(
      <Provider store={store}>
        <PracticeGoalBanner />
      </Provider>
    );

    const goalNote = screen.getByRole('note', { name: /Goal: Factor and solve for x/i });
    expect(goalNote).toBeInTheDocument();
    expect(goalNote.textContent).toContain('Goal: Factor and solve for x');
  });

  test('hides when the practice equation reaches a solved state', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });

    // Set active equation to solved state x = 3
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

    render(
      <Provider store={store}>
        <PracticeGoalBanner />
      </Provider>
    );

    expect(screen.queryByRole('note', { name: /Goal:/i })).toBeNull();
  });
});
