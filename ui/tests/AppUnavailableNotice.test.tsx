// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AppUnavailableNotice } from '@/components/AppUnavailableNotice';

describe('AppUnavailableNotice', () => {
  it('explains that scripts/an extension may be blocking the app', () => {
    render(<AppUnavailableNotice />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByText(/script|extension/i)).toBeInTheDocument();
  });

  it('offers a no-JS reload affordance (a plain link, not a JS button)', () => {
    render(<AppUnavailableNotice />);
    // A link with an href works even when scripts are fully blocked.
    const reload = screen.getByRole('link', { name: /reload|try again/i });
    expect(reload).toHaveAttribute('href');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AppUnavailableNotice />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
