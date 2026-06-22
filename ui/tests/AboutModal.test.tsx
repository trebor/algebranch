// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AboutModal } from '@/components/AboutModal';
import { aboutModalOpenAtom } from '@/store/equation';

describe('AboutModal', () => {
  afterEach(cleanup);

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
