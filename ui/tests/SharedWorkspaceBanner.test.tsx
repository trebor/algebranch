// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { SharedWorkspaceBanner } from '@/components/SharedWorkspaceBanner';
import { sharedWorkspaceBannerAtom } from '@/store/sharedWorkspaceBanner';

function renderWith(open: boolean) {
  const store = createStore();
  store.set(sharedWorkspaceBannerAtom, open);
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
});
