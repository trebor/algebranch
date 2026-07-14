// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import React from 'react';
import Home from '@/app/page';
import { leftSidebarOpenAtom, rightSidebarSizeAtom, rawTabsAtom, rawActiveTabIdAtom, type WorkspaceTab } from '@/store/equation';
import { parseEquation } from 'math-engine-client';

function makeStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'w',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

describe('Pane Cycling shortcut (F6 / Shift+F6)', () => {
  beforeEach(() => {
    // Set viewport wide so sidebars can be visible
    window.innerWidth = 1200;
  });

  afterEach(() => {
    cleanup();
  });

  it('cycles focus through visible panes', async () => {
    const store = makeStore();
    // Open library and history sidebars so they are visible
    store.set(leftSidebarOpenAtom, true);
    store.set(rightSidebarSizeAtom, 'normal');

    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    // Wait for hydration/initial render
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const tabsList = screen.getByRole('tablist');
    const equationPanel = screen.getByRole('tabpanel', { name: /workspace: w/i });
    const historyRegion = document.getElementById('history-region');
    const libraryRegion = document.getElementById('library-region');

    expect(tabsList).toBeInTheDocument();
    expect(equationPanel).toBeInTheDocument();
    expect(historyRegion).toBeInTheDocument();
    expect(libraryRegion).toBeInTheDocument();

    Object.defineProperty(tabsList, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(equationPanel, 'offsetWidth', { value: 500, configurable: true });
    if (historyRegion) {
      Object.defineProperty(historyRegion, 'offsetWidth', { value: 200, configurable: true });
    }
    if (libraryRegion) {
      Object.defineProperty(libraryRegion, 'offsetWidth', { value: 200, configurable: true });
    }

    const getTargetFocusable = (parent: HTMLElement | null) => {
      if (!parent) return null;
      return parent.querySelector('[role="tree"] [tabindex="0"], [role="treeitem"][tabindex="0"]') || parent.querySelector('[tabindex="0"]');
    };

    // Start by focusing the tabs list
    const activeTab = screen.getByRole('tab', { name: /workspace: w/i });
    activeTab.focus();
    expect(document.activeElement).toBe(activeTab);

    // Press F6 to cycle to Equation Panel
    fireEvent.keyDown(document, { key: 'F6' });
    const activeTerm = getTargetFocusable(equationPanel);
    expect(document.activeElement).toBe(activeTerm || equationPanel);

    // Press F6 to cycle to History Region
    fireEvent.keyDown(document, { key: 'F6' });
    const activeHistoryTerm = getTargetFocusable(historyRegion);
    expect(document.activeElement).toBe(activeHistoryTerm || historyRegion);

    // Press F6 to cycle to Library Region
    fireEvent.keyDown(document, { key: 'F6' });
    const activeLibraryItem = getTargetFocusable(libraryRegion);
    expect(document.activeElement).toBe(activeLibraryItem || libraryRegion);

    // Press F6 to cycle back to Tabs List
    fireEvent.keyDown(document, { key: 'F6' });
    expect(document.activeElement).toBe(activeTab);

    // Press Shift+F6 to cycle backward to Library Region
    fireEvent.keyDown(document, { key: 'F6', shiftKey: true });
    expect(document.activeElement).toBe(activeLibraryItem || libraryRegion);
  });
});
