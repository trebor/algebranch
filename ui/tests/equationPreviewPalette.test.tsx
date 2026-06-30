// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { parseEquation } from 'math-engine-client';
import { PreviewEquationNode } from '@/components/PreviewEquationNode';
import {
  EquationPreviewPaletteContext,
} from '@/components/EquationPreviewPaletteContext';
import {
  EQUATION_PREVIEW_PALETTE_DARK,
  EQUATION_PREVIEW_PALETTE_LIGHT,
} from '@/constants/theme';

const eq = parseEquation('2+x=0');

describe('PreviewEquationNode palette', () => {
  afterEach(cleanup);

  it('defaults to the dark palette (unchanged for existing in-app previews)', () => {
    render(<PreviewEquationNode path="lhs" customEquation={eq} />);
    // The constant "2" carries the dark number colour by default.
    expect(screen.getByText('2').className).toContain(EQUATION_PREVIEW_PALETTE_DARK.number);
  });

  it('applies a provided light palette to leaf glyphs', () => {
    render(
      <EquationPreviewPaletteContext.Provider value={EQUATION_PREVIEW_PALETTE_LIGHT}>
        <PreviewEquationNode path="lhs" customEquation={eq} />
      </EquationPreviewPaletteContext.Provider>,
    );
    expect(screen.getByText('2').className).toContain(EQUATION_PREVIEW_PALETTE_LIGHT.number);
    // And the variable "x" picks up the light variable colour, not the dark one.
    expect(screen.getByText('x').className).toContain(EQUATION_PREVIEW_PALETTE_LIGHT.variable);
    expect(screen.getByText('x').className).not.toContain(EQUATION_PREVIEW_PALETTE_DARK.variable);
  });
});
