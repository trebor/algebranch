// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TooltipCard } from '@/components/TooltipCard';

describe('Workspace tooltip card layout alignment', () => {
  it('renders step count in footer on lower left and timestamp on lower right', () => {
    render(
      <TooltipCard
        eyebrow="Workspace"
        title="Quadratic Solver"
        footer={
          <div className="flex items-center justify-between gap-2 w-full font-sans text-xs">
            <span>3 steps</span>
            <span className="text-right text-white/60 font-medium">Just now</span>
          </div>
        }
      />
    );

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Quadratic Solver')).toBeInTheDocument();
    expect(screen.getByText('3 steps')).toBeInTheDocument();
    expect(screen.getByText('Just now')).toBeInTheDocument();
    // Verify step count is not in meta top right
    expect(screen.queryByText('3 steps')?.closest('.border-b')).toBeNull();
  });
});
