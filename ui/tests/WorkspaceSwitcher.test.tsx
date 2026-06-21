// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  equationInputModalOpenAtom,
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

function renderWith() {
  const store = createStore();
  const tabs = [makeTab('a', 'Alpha workspace'), makeTab('b', 'Beta workspace')];
  store.set(rawTabsAtom, tabs);
  store.set(rawActiveTabIdAtom, 'a');
  const utils = render(
    <Provider store={store}>
      <WorkspaceSwitcher />
    </Provider>,
  );
  return { store, ...utils };
}

const openPopover = async () => {
  await userEvent.click(screen.getByRole('button', { name: /switch workspace/i }));
  return screen.getByRole('menu');
};

describe('WorkspaceSwitcher', () => {
  afterEach(cleanup);

  it('names the active workspace in the trigger and starts collapsed', () => {
    renderWith();
    const trigger = screen.getByRole('button', { name: /switch workspace/i });
    expect(trigger.textContent).toContain('Alpha workspace');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists every workspace when opened', async () => {
    renderWith();
    const menu = await openPopover();
    expect(within(menu).getByText('Alpha workspace')).toBeTruthy();
    expect(within(menu).getByText('Beta workspace')).toBeTruthy();
  });

  it('switches the active tab and closes the popover on selection', async () => {
    const { store } = renderWith();
    const menu = await openPopover();
    await userEvent.click(within(menu).getByText('Beta workspace'));
    expect(store.get(rawActiveTabIdAtom)).toBe('b');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes a workspace from its row', async () => {
    const { store } = renderWith();
    await openPopover();
    const closeButtons = screen.getAllByRole('button', { name: /close workspace/i });
    await userEvent.click(closeButtons[1]);
    expect(store.get(rawTabsAtom).map((t) => t.id)).toEqual(['a']);
  });

  it('opens the new-workspace modal from the footer row and closes the popover', async () => {
    const { store } = renderWith();
    await openPopover();
    await userEvent.click(screen.getByRole('menuitem', { name: /new workspace/i }));
    expect(store.get(equationInputModalOpenAtom)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renames a workspace inline', async () => {
    const { store } = renderWith();
    await openPopover();
    await userEvent.click(screen.getAllByRole('button', { name: /rename workspace/i })[0]);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed{Enter}');
    expect(store.get(rawTabsAtom).find((t) => t.id === 'a')?.name).toBe('Renamed');
  });

  it('dismisses on Escape', async () => {
    renderWith();
    await openPopover();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
