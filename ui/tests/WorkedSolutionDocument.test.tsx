// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The worked-solution document (#130) is the rendered, submittable artifact — the
// shared capture/print target. These tests pin its structure: one numbered row per
// step, the annotated toggle gating justifications + assumptions, and the header
// naming the problem, so the printable/PNG output can't silently lose a step or
// leak explanations in "clean" mode.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { parseEquation } from 'math-engine-client';
import { WorkedSolutionDocument } from '@/components/WorkedSolutionDocument';
import type { DerivationStep } from '@/store/equation';

const steps: DerivationStep[] = [
  { index: 1, equation: parseEquation('a*x = b') },
  { index: 2, equation: parseEquation('x = b/a'), justification: 'Divide both sides by a', assumptions: ['a ≠ 0'] },
  { index: 3, equation: parseEquation('x = b/a'), justification: 'Simplify' },
];

afterEach(cleanup);

describe('WorkedSolutionDocument', () => {
  it('renders one numbered row per derivation step', () => {
    render(<WorkedSolutionDocument steps={steps} annotated branding={false} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // Step numbers are present in order.
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('1')).toBeInTheDocument();
    expect(within(items[2]).getByText('3')).toBeInTheDocument();
  });

  it('shows justifications and assumptions when annotated', () => {
    render(<WorkedSolutionDocument steps={steps} annotated branding={false} />);
    expect(screen.getByText('Divide both sides by a')).toBeInTheDocument();
    expect(screen.getByText(/assuming a ≠ 0/)).toBeInTheDocument();
  });

  it('hides justifications when not annotated (clean chain)', () => {
    render(<WorkedSolutionDocument steps={steps} annotated={false} branding={false} />);
    expect(screen.queryByText('Divide both sides by a')).not.toBeInTheDocument();
    expect(screen.queryByText(/assuming/)).not.toBeInTheDocument();
  });

  it('names the problem in the header', () => {
    render(<WorkedSolutionDocument steps={steps} annotated branding={false} />);
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Solve')).toBeInTheDocument();
    // The problem equation is typeset (its variable glyphs render).
    expect(within(header).getAllByText('a').length).toBeGreaterThan(0);
  });

  it('appends the algebranch.org footer only when branding is on', () => {
    const { rerender } = render(<WorkedSolutionDocument steps={steps} annotated branding={false} />);
    expect(screen.queryByText('algebranch.org')).not.toBeInTheDocument();
    rerender(<WorkedSolutionDocument steps={steps} annotated branding />);
    expect(screen.getByText('algebranch.org')).toBeInTheDocument();
  });
});
