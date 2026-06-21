// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { SharedWorkspaceBanner } from '@/components/SharedWorkspaceBanner';
import { sharedWorkspaceBannerAtom } from '@/store/sharedWorkspaceBanner';
import { rawConsentAtom } from '@/store/consent';
import type { ConsentState } from '@/utils/consent';

function renderWith(open: boolean, consent: ConsentState = 'denied') {
  const store = createStore();
  store.set(sharedWorkspaceBannerAtom, open);
  store.set(rawConsentAtom, consent);
  const utils = render(
    <Provider store={store}>
      <SharedWorkspaceBanner />
    </Provider>,
  );
  return { store, ...utils };
}

describe('SharedWorkspaceBanner', () => {
  afterEach(cleanup);

  it('stays hidden when no shared workspace was opened', () => {
    renderWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('acknowledges the shared workspace and teaches the feature', () => {
    renderWith(true);
    const banner = screen.getByRole('dialog');
    // The whole point: tell the recipient the link restored a full derivation.
    expect(banner.textContent).toMatch(/derivation|worked solution/i);
  });

  it('dismissing it lowers the banner atom', async () => {
    const { store } = renderWith(true);
    await userEvent.click(screen.getByRole('button', { name: /got it|dismiss/i }));
    expect(store.get(sharedWorkspaceBannerAtom)).toBe(false);
  });

  it('takes focus once consent is resolved', () => {
    renderWith(true, 'denied');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /got it/i }));
  });

  it('yields focus to the cookie consent banner while consent is unresolved', () => {
    // Opening a ?ws= link on first run shows both banners; consent must win focus.
    renderWith(true, 'unset');
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: /got it/i }));
  });
});
