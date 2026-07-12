// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider, createStore, useAtom } from 'jotai';
import { HelpModal } from '@/components/HelpModal';
import { ShortcutsOverlay } from '@/components/ShortcutsOverlay';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { helpModalOpenAtom, shortcutsOverlayOpenAtom, activeHelpDocAtom } from '@/store/equation';
import { HELP_DOC_SLUGS, DOC_BY_SLUG } from '@/constants/docsPages';

const HelpModalTestWrapper: React.FC = () => {
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
      <ShortcutsOverlay shortcuts={[]} />
    </>
  );
};

describe('HelpModal', () => {
  afterEach(cleanup);

  it('renders each documentation card as an in-app button, not a new-tab link', () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);
    render(
      <Provider store={store}>
        <HelpModal />
      </Provider>
    );

    // Each guide is an in-app launcher button (#514) that opens the DocModal in
    // place, never a `target="_blank"` anchor that navigates away to a new tab.
    for (const name of [/user guide/i, /scope & capabilities/i, /features reference/i, /frequently asked questions/i]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
  });

  it('aligns the cards with /docs — same set, order, and titles as DOCS_PAGES', () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);
    render(
      <Provider store={store}>
        <HelpModal />
      </Provider>
    );

    // The launcher must not invent its own titles or order (it used to say
    // "Mathematical Scope" / "FAQ Reference" out of sequence). Cards are derived
    // from DOCS_PAGES, so they carry the route titles in the route order — the
    // same list /docs renders.
    const cards = HELP_DOC_SLUGS.map((slug) =>
      screen.getByRole('button', { name: new RegExp(DOC_BY_SLUG[slug].title, 'i') }),
    );
    for (let i = 1; i < cards.length; i += 1) {
      const following =
        cards[i - 1].compareDocumentPosition(cards[i]) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(following, `${HELP_DOC_SLUGS[i]} should follow ${HELP_DOC_SLUGS[i - 1]}`).toBeTruthy();
    }
  });

  it('opens the picked guide in the doc modal and dismisses the launcher', () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);
    render(
      <Provider store={store}>
        <HelpModal />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /scope & capabilities/i }));

    // The card sets the active-doc atom (DocModal renders it and syncs the URL)
    // and closes the launcher so it isn't left stacked behind the doc overlay.
    expect(store.get(activeHelpDocAtom)).toBe('scope');
    expect(store.get(helpModalOpenAtom)).toBe(false);
  });

  it('closes help modal and opens shortcuts modal when k is pressed', async () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);
    store.set(shortcutsOverlayOpenAtom, false);

    render(
      <Provider store={store}>
        <HelpModalTestWrapper />
      </Provider>
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));

    expect(store.get(helpModalOpenAtom)).toBe(false);
    expect(store.get(shortcutsOverlayOpenAtom)).toBe(true);
  });

  it('closes help modal when ? is pressed', async () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);

    render(
      <Provider store={store}>
        <HelpModalTestWrapper />
      </Provider>
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));

    expect(store.get(helpModalOpenAtom)).toBe(false);
  });
});
