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

  beforeEach(() => {
    onOpenSettings = vi.fn();
    onOpenAbout = vi.fn();
    onOpenHelp = vi.fn();
  });

  afterEach(cleanup);

  const renderMenu = () =>
    render(
      <HeaderOverflowMenu
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
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
