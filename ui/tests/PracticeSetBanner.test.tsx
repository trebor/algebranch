// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { PracticeSetBanner } from '../src/components/PracticeSetBanner';
import {
  terminalStatusAtom,
  tabsAtom,
  activeTabIdAtom,
} from '../src/store/equation';
import { startPracticeSetAtom, PRACTICE_SET_STORAGE_KEY } from '../src/store/ladders';
import { parseEquation, ensureNodeIds } from 'math-engine-client';
import { safeStorage, __resetMemoryStore } from '../src/utils/safeStorage';

describe('PracticeSetBanner Component', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    safeStorage.removeItem(PRACTICE_SET_STORAGE_KEY);
    __resetMemoryStore();
    store = createStore();
  });

  test('does not render when no practice set is active', () => {
    render(
      <Provider store={store}>
        <PracticeSetBanner />
      </Provider>
    );

    expect(screen.queryByRole('region', { name: /Practice Set Progress/i })).toBeNull();
  });

  test('renders Next Problem button when set is active and equation is solved', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });

    // Set current equation to solved form x = 3
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
        <PracticeSetBanner />
      </Provider>
    );

    expect(screen.getByRole('region', { name: /Practice Set Progress/i })).toBeInTheDocument();
    expect(screen.getByText(/Practice Set · Linear Equations/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next Problem/i })).toBeInTheDocument();
  });

  test('advances to next problem when Next Problem button is clicked', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });

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
        <PracticeSetBanner />
      </Provider>
    );

    const btn = screen.getByRole('button', { name: /Next Problem/i });
    fireEvent.click(btn);

    const newTabs = store.get(tabsAtom);
    const newActiveId = store.get(activeTabIdAtom);
    const activeTab = newTabs.find((t) => t.id === newActiveId);
    expect(activeTab?.name).toBe('Negative Coefficients');
  });

  test('renders when terminalStatusAtom is contradiction or identity', () => {
    store.set(startPracticeSetAtom, { setId: 'linear_basics' });
    store.set(terminalStatusAtom, 'contradiction');

    render(
      <Provider store={store}>
        <PracticeSetBanner />
      </Provider>
    );

    expect(screen.getByRole('region', { name: /Practice Set Progress/i })).toBeInTheDocument();
  });
});
