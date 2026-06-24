// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { Sidebar } from '@/components/Sidebar';

describe('Sidebar landmark (#237)', () => {
  afterEach(cleanup);

  it('wraps the left sidebar in a complementary landmark with an accessible name', () => {
    // The sidebar holds the workspace controls and the equation library; an
    // <aside> exposes it to a screen-reader rotor as a "jump to" target distinct
    // from the heading outline (no landmark previously existed here).
    render(<Provider store={createStore()}><Sidebar /></Provider>);
    expect(
      screen.getByRole('complementary', { name: /workspace and library/i }),
    ).toBeInTheDocument();
  });
});
