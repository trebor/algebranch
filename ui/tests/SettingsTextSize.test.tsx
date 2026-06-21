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

describe('SettingsModal — text-size control (#239)', () => {
  afterEach(cleanup);

  it('exposes a radiogroup of text-size options with Default selected', () => {
    renderModal();
    const group = screen.getByRole('radiogroup', { name: /text size/i });
    const options = within(group).getAllByRole('radio');
    expect(options.length).toBeGreaterThanOrEqual(2);
    const checked = options.filter((o) => o.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName(/default/i);
  });

  it('updates the persisted chrome scale when a larger size is chosen', async () => {
    const user = userEvent.setup();
    const { store } = renderModal();
    const group = screen.getByRole('radiogroup', { name: /text size/i });
    await user.click(within(group).getByRole('radio', { name: /larger/i }));
    expect(store.get(rawSettingsAtom).chromeScale).toBeGreaterThan(1);
  });

  it('has no structural a11y violations in the settings dialog', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
