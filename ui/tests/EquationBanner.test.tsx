// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { EquationBanner } from '@/components/EquationBanner';
import { TriangleAlert } from 'lucide-react';

describe('EquationBanner Primitive (#569)', () => {
  afterEach(cleanup);

  it('renders children and custom icon', () => {
    render(
      <EquationBanner variant="amber" icon={<TriangleAlert data-testid="icon" />} ariaLabel="Test Banner">
        <span>given x ≠ 0</span>
      </EquationBanner>
    );

    expect(screen.getByRole('note', { name: 'Test Banner' })).toBeInTheDocument();
    expect(screen.getByText('given x ≠ 0')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies correct variant styles for amber and red', () => {
    const { container: amberContainer } = render(
      <EquationBanner variant="amber" ariaLabel="Amber Banner">
        Amber content
      </EquationBanner>
    );
    expect(amberContainer.firstChild).toHaveClass('text-amber-300');

    cleanup();

    const { container: redContainer } = render(
      <EquationBanner variant="red" ariaLabel="Red Banner">
        Red content
      </EquationBanner>
    );
    expect(redContainer.firstChild).toHaveClass('text-red-200');
  });
});
