// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ErrorFallback } from '@/components/ErrorFallback';

describe('ErrorFallback', () => {
  it('renders a non-blank, human-readable fallback instead of a white screen', () => {
    render(<ErrorFallback onRetry={() => {}} />);
    // A heading the user can actually read (no reliance on app chrome).
    expect(screen.getByRole('heading')).toBeInTheDocument();
    // Names the likely cause so blocking-extension users understand what happened.
    expect(screen.getByText(/extension/i)).toBeInTheDocument();
  });

  it('invokes the retry callback when the user clicks "Try again"', async () => {
    const onRetry = vi.fn();
    render(<ErrorFallback onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ErrorFallback onRetry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
