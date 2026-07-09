// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { axe } from 'jest-axe';
import { SettingsModal } from '@/components/SettingsModal';
import {
  settingsModalOpenAtom,
  rawSettingsAtom,
  DEFAULT_SETTINGS,
} from '@/store/equation';

const DEFAULT_SPEED_NAME = /1×/i;
const SLOWER_SPEED_NAME = /0.5×/i;
const GROUP_LABEL = /animation speed/i;
const EXPECTED_MIN_OPTIONS = 2;
const EXPECTED_CHECKED_LENGTH = 1;
const CHOSEN_SPEED = 0.5;

function renderModal() {
  const store = createStore();
  store.set(settingsModalOpenAtom, true);
  store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS });
  const result = render(
    <Provider store={store}>
      <SettingsModal />
    </Provider>,
  );
  return { store, ...result };
}

describe('SettingsModal — animation speed control', () => {
  afterEach(cleanup);

  it('exposes a radiogroup of animation speed options with 1x selected', () => {
    renderModal();
    const group = screen.getByRole('radiogroup', { name: GROUP_LABEL });
    const options = within(group).getAllByRole('radio');
    expect(options.length).toBeGreaterThanOrEqual(EXPECTED_MIN_OPTIONS);
    const checked = options.filter((o) => o.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(EXPECTED_CHECKED_LENGTH);
    expect(checked[0]).toHaveAccessibleName(DEFAULT_SPEED_NAME);
  });

  it('updates the persisted animation speed when a slower speed is chosen', async () => {
    const user = userEvent.setup();
    const { store } = renderModal();
    const group = screen.getByRole('radiogroup', { name: GROUP_LABEL });
    await user.click(within(group).getByRole('radio', { name: SLOWER_SPEED_NAME }));
    expect(store.get(rawSettingsAtom).animationSpeed).toBe(CHOSEN_SPEED);
  });

  it('has no structural a11y violations in the settings dialog', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
