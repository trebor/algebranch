// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore, useAtom } from 'jotai';
import { ShortcutsOverlay } from '@/components/ShortcutsOverlay';
import { HelpModal } from '@/components/HelpModal';
import { useKeyboardShortcuts, ShortcutConfig } from '@/hooks/useKeyboardShortcuts';
import { shortcutsOverlayOpenAtom, helpModalOpenAtom } from '@/store/equation';

const ShortcutsOverlayTestWrapper: React.FC<{ shortcuts: ShortcutConfig[] }> = ({ shortcuts }) => {
  const [helpOpen, setHelpOpen] = useAtom(helpModalOpenAtom);
  const [shortcutsOpen, setShortcutsOpen] = useAtom(shortcutsOverlayOpenAtom);

  const closeAllModals = () => {
    setHelpOpen(false);
    setShortcutsOpen(false);
  };

  useKeyboardShortcuts([
    {
      key: '?',
      shift: true,
      action: () => {
        const nextState = !helpOpen;
        closeAllModals();
        if (nextState) setHelpOpen(true);
      },
      description: 'Help',
    },
    {
      key: 'k',
      action: () => {
        const nextState = !shortcutsOpen;
        closeAllModals();
        if (nextState) setShortcutsOpen(true);
      },
      description: 'Shortcuts',
    },
  ], { disabled: false });

  return (
    <>
      <HelpModal />
      <ShortcutsOverlay shortcuts={shortcuts} />
    </>
  );
};

describe('ShortcutsOverlay', () => {
  afterEach(cleanup);

  const mockShortcuts = [
    {
      key: 'z',
      meta: true,
      action: () => {},
      description: 'Undo step',
      category: 'History',
    },
    {
      key: '?',
      shift: true,
      action: () => {},
      description: 'Help',
      category: 'Help',
      keyLabel: '?',
    },
  ];

  it('renders when open', () => {
    const store = createStore();
    store.set(shortcutsOverlayOpenAtom, true);
    render(
      <Provider store={store}>
        <ShortcutsOverlay shortcuts={mockShortcuts} />
      </Provider>
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    expect(screen.getByText('Undo step')).toBeTruthy();
  });

  it('closes shortcuts overlay and opens help modal when ? is pressed', async () => {
    const store = createStore();
    store.set(shortcutsOverlayOpenAtom, true);
    store.set(helpModalOpenAtom, false);

    render(
      <Provider store={store}>
        <ShortcutsOverlayTestWrapper shortcuts={mockShortcuts} />
      </Provider>
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));

    expect(store.get(shortcutsOverlayOpenAtom)).toBe(false);
    expect(store.get(helpModalOpenAtom)).toBe(true);
  });

  it('renders the reopen-key footer hint from the source-of-truth binding, formatted like every other keycap (#245)', () => {
    const store = createStore();
    store.set(shortcutsOverlayOpenAtom, true);

    render(
      <Provider store={store}>
        <ShortcutsOverlay
          shortcuts={[
            {
              key: 'j',
              id: 'shortcuts-overlay',
              action: () => {},
              description: 'Show keyboard shortcuts',
              category: 'Help',
            },
          ]}
        />
      </Provider>
    );

    // Both the list row and the footer hint derive their keycap from the same
    // binding: the actual key ('j', proving the footer isn't hardcoded to 'k'),
    // uppercased by formatShortcut like every other letter keycap in the app.
    const keycaps = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keycaps.filter((c) => c === 'J')).toHaveLength(2);
    expect(keycaps).not.toContain('j');
    expect(keycaps).not.toContain('k');
  });

  it('closes shortcuts overlay when k is pressed', async () => {
    const store = createStore();
    store.set(shortcutsOverlayOpenAtom, true);

    render(
      <Provider store={store}>
        <ShortcutsOverlayTestWrapper shortcuts={mockShortcuts} />
      </Provider>
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));

    expect(store.get(shortcutsOverlayOpenAtom)).toBe(false);
  });
});
