// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { axe } from 'jest-axe';
import { SettingsModal } from '@/components/SettingsModal';
import {
  settingsModalOpenAtom,
  rawSettingsAtom,
  DEFAULT_SETTINGS,
} from '@/store/equation';

function renderModal(initialSettings = DEFAULT_SETTINGS) {
  const store = createStore();
  store.set(settingsModalOpenAtom, true);
  store.set(rawSettingsAtom, { ...initialSettings });
  const result = render(
    <Provider store={store}>
      <SettingsModal />
    </Provider>,
  );
  return { store, ...result };
}

describe('SettingsModal — capability gates control', () => {
  afterEach(cleanup);

  it('exposes switches for individual capabilities', () => {
    renderModal();
    expect(screen.getByRole('switch', { name: /toggle allow decimals option/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /toggle allow complex numbers option/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /toggle progressive simplification option/i })).toBeTruthy();
  });

  it('toggles gate values and updates store', async () => {
    const user = userEvent.setup();
    const { store } = renderModal();

    const decimalSwitch = screen.getByRole('switch', { name: /toggle allow decimals option/i });
    expect(decimalSwitch.getAttribute('aria-checked')).toBe('false');

    await user.click(decimalSwitch);
    expect(decimalSwitch.getAttribute('aria-checked')).toBe('true');
    expect(store.get(rawSettingsAtom).allowEvaluateToDecimal).toBe(true);
  });

  it('has no structural a11y violations in the settings dialog', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
