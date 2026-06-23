// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { WorkspaceTabs } from '@/components/WorkspaceTabs';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
} from '@/store/equation';

const makeTab = (id: string, name: string): WorkspaceTab => ({
  id,
  name,
  historyTree: {
    '0': { id: '0', equation: null as never, parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
  },
  currentNodeId: '0',
  isCustomNamed: true,
  timestamp: 1,
});

function renderWith(activeId = 'a') {
  const store = createStore();
  store.set(rawTabsAtom, [makeTab('a', 'Alpha workspace'), makeTab('b', 'Beta workspace')]);
  store.set(rawActiveTabIdAtom, activeId);
  const utils = render(
    <Provider store={store}>
      <WorkspaceTabs />
    </Provider>,
  );
  return { store, ...utils };
}

describe('WorkspaceTabs keyboard/a11y semantics', () => {
  afterEach(cleanup);

  it('exposes the selected tab as the single Tab stop, labelled by its workspace name', () => {
    renderWith('b');
    const active = screen.getByRole('tab', { name: /Beta workspace/i });
    expect(active).toHaveAttribute('tabindex', '0');
  });

  it('marks the active tab as selected (not a toggle)', () => {
    renderWith('a');
    const active = screen.getByRole('tab', { name: /Alpha workspace/i });
    const inactive = screen.getByRole('tab', { name: /Beta workspace/i });
    // Workspaces are mutually exclusive tabs, so the active one is the selected
    // tab — not an independent on/off toggle (which aria-pressed would announce).
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).not.toHaveAttribute('aria-pressed');
    expect(inactive).toHaveAttribute('aria-selected', 'false');
  });

  it('switches the active workspace on Enter', () => {
    const { store } = renderWith('a');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Beta workspace/i }), { key: 'Enter' });
    expect(store.get(rawActiveTabIdAtom)).toBe('b');
  });

  it('switches the active workspace on Space', () => {
    const { store } = renderWith('a');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Beta workspace/i }), { key: ' ' });
    expect(store.get(rawActiveTabIdAtom)).toBe('b');
  });

  it('gives each tab a visible keyboard-focus indicator', () => {
    renderWith();
    expect(screen.getByRole('tab', { name: /Alpha workspace/i }).className).toContain('focus-visible:ring');
  });

  it('groups the tab strip in a Workspaces navigation landmark (#257)', () => {
    renderWith();
    expect(screen.getByRole('navigation', { name: /workspaces/i })).toBeInTheDocument();
  });
});
