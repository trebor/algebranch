// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PeekHandle } from '@/components/PeekHandle';

// PeekHandle (#252) is the always-reachable escape from immersive mode: thin
// tabs at the top and bottom edges that slide the hidden header + BottomNav back
// in. It is only mounted while immersive is active, so it never pollutes the tab
// order when the chrome is shown — the parent owns that gating.

describe('PeekHandle (#252)', () => {
  afterEach(cleanup);

  it('renders a top and a bottom handle, both named "Show toolbars"', () => {
    render(<PeekHandle onExit={() => {}} />);
    const handles = screen.getAllByRole('button', { name: /show toolbars/i });
    expect(handles).toHaveLength(2);
  });

  it('exposes real <button>s so they are keyboard-focusable and Enter-activatable', () => {
    render(<PeekHandle onExit={() => {}} />);
    for (const handle of screen.getAllByRole('button', { name: /show toolbars/i })) {
      expect(handle.tagName).toBe('BUTTON');
    }
  });

  it('calls onExit when a handle is clicked', () => {
    const onExit = vi.fn();
    render(<PeekHandle onExit={onExit} />);
    const handles = screen.getAllByRole('button', { name: /show toolbars/i });
    fireEvent.click(handles[0]);
    fireEvent.click(handles[1]);
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it('has no structural a11y violations', async () => {
    const { container } = render(<PeekHandle onExit={() => {}} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
