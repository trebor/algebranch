// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderOverflowMenu } from '@/components/HeaderOverflowMenu';

describe('HeaderOverflowMenu', () => {
  let onOpenSettings: () => void;
  let onOpenAbout: () => void;
  let onOpenHelp: () => void;
  let onOpenShortcuts: () => void;

  beforeEach(() => {
    onOpenSettings = vi.fn();
    onOpenAbout = vi.fn();
    onOpenHelp = vi.fn();
    onOpenShortcuts = vi.fn();
  });

  afterEach(cleanup);

  const renderMenu = () =>
    render(
      <HeaderOverflowMenu
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
        onOpenShortcuts={onOpenShortcuts}
      />
    );

  it('initially does not show the dropdown menu', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the menu when the trigger button is clicked', async () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /more options/i });
    await userEvent.click(trigger);

    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /settings/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /about/i })).toBeTruthy();
  });

  it('calls onOpenSettings and closes the menu when Settings is clicked', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /settings/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onOpenAbout and closes the menu when About is clicked', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /about/i }));

    expect(onOpenAbout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onOpenHelp and closes the menu when Help is clicked', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /help/i }));

    expect(onOpenHelp).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onOpenShortcuts and closes the menu when Shortcuts is clicked (#440, #449)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^shortcuts$/i }));

    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shortens the shortcuts label to just "Shortcuts" (#449)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('offers a GitHub link that opens the repo in a new tab, placed above About (#449)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    const github = within(menu).getByRole('menuitem', { name: /github/i });
    expect(github).toHaveAttribute('href', 'https://github.com/trebor/algebranch');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github.getAttribute('rel') ?? '').toContain('noopener');

    // GitHub sits immediately above About in the menu order.
    const items = within(menu).getAllByRole('menuitem');
    const githubIndex = items.indexOf(github);
    const aboutIndex = items.findIndex((el) => /about/i.test(el.textContent ?? ''));
    expect(githubIndex).toBeGreaterThanOrEqual(0);
    expect(aboutIndex).toBe(githubIndex + 1);
  });

  it('shows each item\'s keyboard-shortcut keycap, mirroring the global bindings', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    const menu = screen.getByRole('menu');

    const keycapFor = (name: RegExp) =>
      within(within(menu).getByRole('menuitem', { name })).getByText(
        (_content, el) => el?.tagName.toLowerCase() === 'kbd',
      );

    expect(keycapFor(/settings/i).textContent).toBe(',');
    expect(keycapFor(/help/i).textContent).toBe('?');
    expect(keycapFor(/^shortcuts$/i).textContent).toBe('K');
    expect(keycapFor(/about/i).textContent).toBe('A');
  });

  it('keeps the keycaps out of the menu-item accessible names (aria-hidden)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    const menu = screen.getByRole('menu');

    // Names stay clean — the keycap glyph must not leak into the label a screen
    // reader announces (would read e.g. "Shortcuts K").
    expect(within(menu).getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /^settings$/i })).toBeTruthy();
  });

  it('has no keycap on the GitHub link (it has no shortcut)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    const menu = screen.getByRole('menu');

    const github = within(menu).getByRole('menuitem', { name: /github/i });
    expect(github.querySelector('kbd')).toBeNull();
  });

  it('closes the menu when Escape is pressed', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    expect(screen.getByRole('menu')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu when clicking outside the container', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    expect(screen.getByRole('menu')).toBeTruthy();

    // Click outside
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
