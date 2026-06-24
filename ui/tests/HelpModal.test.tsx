// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore, useAtom } from 'jotai';
import { HelpModal } from '@/components/HelpModal';
import { ShortcutsOverlay } from '@/components/ShortcutsOverlay';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { helpModalOpenAtom, shortcutsOverlayOpenAtom } from '@/store/equation';
import { GITHUB_REPO_URL } from '@/constants/about';

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

  it('renders all documentation links when open', () => {
    const store = createStore();
    store.set(helpModalOpenAtom, true);
    render(
      <Provider store={store}>
        <HelpModal />
      </Provider>
    );

    const userGuideLink = screen.getByRole('link', { name: /user guide/i }) as HTMLAnchorElement;
    expect(userGuideLink).toBeTruthy();
    expect(userGuideLink.href).toBe(`${GITHUB_REPO_URL}/blob/main/docs/user-guide.md`);
    expect(userGuideLink.target).toBe('_blank');

    const faqLink = screen.getByRole('link', { name: /faq reference/i }) as HTMLAnchorElement;
    expect(faqLink).toBeTruthy();
    expect(faqLink.href).toBe(`${GITHUB_REPO_URL}/blob/main/docs/faq.md`);
    expect(faqLink.target).toBe('_blank');

    const scopeLink = screen.getByRole('link', { name: /mathematical scope/i }) as HTMLAnchorElement;
    expect(scopeLink).toBeTruthy();
    expect(scopeLink.href).toBe(`${GITHUB_REPO_URL}/blob/main/docs/scope.md`);
    expect(scopeLink.target).toBe('_blank');

    const featuresLink = screen.getByRole('link', { name: /features reference/i }) as HTMLAnchorElement;
    expect(featuresLink).toBeTruthy();
    expect(featuresLink.href).toBe(`${GITHUB_REPO_URL}/blob/main/docs/features.md`);
    expect(featuresLink.target).toBe('_blank');
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
