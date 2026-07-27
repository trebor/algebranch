import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { HeaderOverflowMenu } from '@/components/HeaderOverflowMenu';
import {
  exportWorkspacesModalOpenAtom,
  importWorkspacesModalOpenAtom,
  pwaInstallPromptAtom,
} from '@/store/equation';

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

  const renderMenu = (store = createStore()) => {
    const result = render(
      <Provider store={store}>
        <HeaderOverflowMenu
          onOpenSettings={onOpenSettings}
          onOpenAbout={onOpenAbout}
          onOpenHelp={onOpenHelp}
          onOpenShortcuts={onOpenShortcuts}
        />
      </Provider>,
    );
    return { store, ...result };
  };

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
    expect(within(menu).getByRole('menuitem', { name: /import workspaces/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /export workspaces/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /about/i })).toBeTruthy();
  });

  it('calls onOpenSettings and closes the menu when Settings is clicked', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /settings/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('triggers Import Workspaces modal and closes menu', async () => {
    const { store } = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /import workspaces/i }));

    expect(store.get(importWorkspacesModalOpenAtom)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('triggers Export Workspaces modal and closes menu', async () => {
    const { store } = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /export workspaces/i }));

    expect(store.get(exportWorkspacesModalOpenAtom)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows Install App when PWA prompt is available', async () => {
    const store = createStore();
    const mockPromptEvent = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
    store.set(pwaInstallPromptAtom, mockPromptEvent as unknown as Event);

    renderMenu(store);
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    const installItem = within(menu).getByRole('menuitem', { name: /install app/i });
    expect(installItem).toBeTruthy();

    await userEvent.click(installItem);
    expect(mockPromptEvent.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does NOT show Install App when PWA prompt is null', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /install app/i })).toBeNull();
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

  it('calls onOpenShortcuts and closes the menu when Shortcuts is clicked', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^shortcuts$/i }));

    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('organizes items into grouped sections with visual dividers', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    const itemTexts = items.map((item) => item.querySelector('span')?.textContent?.trim());

    // Section 1: Settings, Import Workspaces, Export Workspaces
    // Section 2: Help, Shortcuts
    // Section 3: About, GitHub
    expect(itemTexts).toEqual([
      'Settings',
      'Import Workspaces',
      'Export Workspaces',
      'Help',
      'Shortcuts',
      'About',
      'GitHub',
    ]);

    const dividers = menu.querySelectorAll('[role="separator"]');
    expect(dividers.length).toBe(2);
  });

  it('offers a GitHub link that opens the repo in a new tab in Section 3', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    const menu = screen.getByRole('menu');
    const github = within(menu).getByRole('menuitem', { name: /github/i });
    expect(github).toHaveAttribute('href', 'https://github.com/trebor/algebranch');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github.getAttribute('rel') ?? '').toContain('noopener');
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

    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

