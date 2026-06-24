// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ImmersiveToggle } from '@/components/ImmersiveToggle';

// ImmersiveToggle (#252) is the header entry point into immersive mode — a
// Maximize-style button shown only on short screens while the chrome is visible
// (page.tsx owns that gating). Activating it hides the header + BottomNav.

describe('ImmersiveToggle (#252)', () => {
  afterEach(cleanup);

  it('renders a button named "Hide toolbars"', () => {
    render(<ImmersiveToggle onEnter={() => {}} />);
    expect(screen.getByRole('button', { name: /hide toolbars/i })).toBeInTheDocument();
  });

  it('calls onEnter when clicked', () => {
    const onEnter = vi.fn();
    render(<ImmersiveToggle onEnter={onEnter} />);
    fireEvent.click(screen.getByRole('button', { name: /hide toolbars/i }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('has no structural a11y violations', async () => {
    const { container } = render(<ImmersiveToggle onEnter={() => {}} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
