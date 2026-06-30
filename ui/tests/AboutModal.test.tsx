// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AboutModal } from '@/components/AboutModal';
import { aboutModalOpenAtom } from '@/store/equation';

// The displayed version must come from the build-time single source of truth
// (`@/constants/version`, fed from the root package.json via next.config.ts),
// not a hand-edited constant — see issue #157.
vi.mock('@/constants/version', () => ({ APP_VERSION: '9.9.9-test' }));

describe('AboutModal', () => {
  afterEach(cleanup);

  it('displays the build-time app version from constants/version', () => {
    const store = createStore();
    store.set(aboutModalOpenAtom, true);
    render(
      <Provider store={store}>
        <AboutModal />
      </Provider>
    );

    expect(screen.getByText('v9.9.9-test')).toBeTruthy();
  });

  it('renders the GitHub repository link when open', () => {
    const store = createStore();
    store.set(aboutModalOpenAtom, true);
    render(
      <Provider store={store}>
        <AboutModal />
      </Provider>
    );

    const link = screen.getByRole('link', { name: /github/i }) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe('https://github.com/trebor/algebranch');
  });
});
