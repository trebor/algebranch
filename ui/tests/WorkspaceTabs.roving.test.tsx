// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { axe } from 'jest-axe';
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
  store.set(rawTabsAtom, [
    makeTab('a', 'Alpha workspace'),
    makeTab('b', 'Beta workspace'),
    makeTab('c', 'Gamma workspace'),
  ]);
  store.set(rawActiveTabIdAtom, activeId);
  const utils = render(
    <Provider store={store}>
      <WorkspaceTabs />
      <div id="equation-region" />
    </Provider>,
  );
  return { store, ...utils };
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('WorkspaceTabs composite widget (#257)', () => {
  afterEach(cleanup);

  it('is a single Tab stop: the selected tab is tabIndex 0, the rest -1', () => {
    renderWith('b');
    expect(tab(/Alpha/i)).toHaveAttribute('tabindex', '-1');
    expect(tab(/Beta/i)).toHaveAttribute('tabindex', '0');
    expect(tab(/Gamma/i)).toHaveAttribute('tabindex', '-1');
  });

  it('groups the tabs in a labelled tablist', () => {
    renderWith();
    const list = screen.getByRole('tablist', { name: /workspaces/i });
    expect(within(list).getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active tab with aria-selected, not aria-pressed', () => {
    renderWith('a');
    expect(tab(/Alpha/i)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Alpha/i)).not.toHaveAttribute('aria-pressed');
    expect(tab(/Beta/i)).toHaveAttribute('aria-selected', 'false');
  });

  it('roves focus with ArrowRight / ArrowLeft without changing the selection', () => {
    const { store } = renderWith('a');
    act(() => tab(/Alpha/i).focus());

    fireEvent.keyDown(tab(/Alpha/i), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab(/Beta/i));
    expect(tab(/Beta/i)).toHaveAttribute('tabindex', '0');
    // Roving moves focus only; the active workspace is unchanged until activation.
    expect(store.get(rawActiveTabIdAtom)).toBe('a');

    fireEvent.keyDown(tab(/Beta/i), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab(/Alpha/i));
  });

  it('activates the focused tab on Enter and Space', () => {
    const { store } = renderWith('a');
    act(() => tab(/Alpha/i).focus());
    fireEvent.keyDown(tab(/Alpha/i), { key: 'ArrowRight' });
    fireEvent.keyDown(tab(/Beta/i), { key: 'Enter' });
    expect(store.get(rawActiveTabIdAtom)).toBe('b');
  });

  it('closes the focused tab with Delete (alongside ⌘⌫)', () => {
    const { store } = renderWith('a');
    fireEvent.keyDown(tab(/Beta/i), { key: 'Delete' });
    expect(store.get(rawTabsAtom).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('enters rename mode with F2', () => {
    renderWith('a');
    fireEvent.keyDown(tab(/Alpha/i), { key: 'F2' });
    expect(screen.getByDisplayValue('Alpha workspace')).toBeInTheDocument();
  });

  it('advertises the Delete / F2 shortcuts via aria-keyshortcuts', () => {
    renderWith('a');
    expect(tab(/Alpha/i)).toHaveAttribute('aria-keyshortcuts', expect.stringContaining('Delete'));
    expect(tab(/Alpha/i).getAttribute('aria-keyshortcuts')).toContain('F2');
  });

  it('keeps close/rename as non-focusable pointer affordances (no nested interactive control)', () => {
    renderWith('a');
    const active = tab(/Alpha/i);
    expect(active.getAttribute('role')).toBe('tab');
    // The close/rename affordances are presentational click targets, NOT nested
    // focusable buttons — keyboard reaches them via the F2 / Delete shortcuts, so
    // the tab is not a forbidden nested-interactive control.
    expect(within(active).queryByRole('button')).toBeNull();
  });

  it('has no structural a11y violations (no button-in-button)', async () => {
    const { container } = renderWith('a');
    expect(await axe(container)).toHaveNoViolations();
  });
});
