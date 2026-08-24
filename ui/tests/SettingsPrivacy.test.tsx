// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { SettingsModal } from '@/components/SettingsModal';
import {
  settingsModalOpenAtom,
  rawSettingsAtom,
  DEFAULT_SETTINGS,
} from '@/store/equation';
import { rawConsentAtom, consentAtom } from '@/store/consent';
import type { ConsentState } from '@/utils/consent';

function renderModal(consentState: ConsentState = 'denied') {
  const store = createStore();
  store.set(settingsModalOpenAtom, true);
  store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS });
  store.set(rawConsentAtom, consentState);
  const result = render(
    <Provider store={store}>
      <SettingsModal />
    </Provider>,
  );
  return { store, ...result };
}

describe('SettingsModal — Privacy & Analytics toggle', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders analytics toggle off by default when consent is denied', () => {
    renderModal('denied');
    const toggle = screen.getByRole('switch', { name: /analytics/i });
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('renders analytics toggle on when consent is granted', () => {
    renderModal('granted');
    const toggle = screen.getByRole('switch', { name: /analytics/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('toggles analytics on and off when clicked', async () => {
    const { store } = renderModal('denied');
    const toggle = screen.getByRole('switch', { name: /analytics/i });

    await userEvent.click(toggle);
    expect(store.get(consentAtom)).toBe('granted');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    await userEvent.click(toggle);
    expect(store.get(consentAtom)).toBe('denied');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('does not render the obsolete cookie settings button', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /cookie settings/i })).toBeNull();
  });
});
