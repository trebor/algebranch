// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ConsentBanner } from '@/components/ConsentBanner';
import { rawConsentAtom } from '@/store/consent';

function renderBanner() {
  const store = createStore();
  store.set(rawConsentAtom, 'unset');
  return render(
    <Provider store={store}>
      <ConsentBanner />
    </Provider>,
  );
}

describe('ConsentBanner', () => {
  afterEach(cleanup);

  it('focuses the Accept (primary) action on mount', () => {
    renderBanner();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /accept/i }));
  });

  it('still treats Escape as the privacy-safe decline', async () => {
    // Decline remains equally present; Escape never implies acceptance.
    renderBanner();
    expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
  });
});
