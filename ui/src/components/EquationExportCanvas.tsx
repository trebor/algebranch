// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import Image from 'next/image';
import type { Equation } from 'math-engine-client';
import {
  EQUATION_PREVIEW_PALETTE_DARK,
  EQUATION_PREVIEW_PALETTE_LIGHT,
} from '../constants/theme';
import { EquationPreviewPaletteContext } from './EquationPreviewPaletteContext';
import { PreviewEquationNode } from './PreviewEquationNode';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { type ImageBackground, backgroundColorFor, foregroundColorFor } from '../utils/equationImage';

/**
 * A single equation typeset on a chosen export background, with an optional
 * algebranch.org footer — the capture/print target for the "This equation" scope
 * of the unified export (#130, extracted from the original #335 image dialog). The
 * ref exposes the exact node `captureNodeToPng` rasterizes.
 */

interface EquationExportCanvasProps {
  readonly equation: Equation;
  readonly bg: ImageBackground;
  readonly branding: boolean;
}

export const EquationExportCanvas = React.forwardRef<HTMLDivElement, EquationExportCanvasProps>(
  function EquationExportCanvas({ equation, bg, branding }, ref) {
    // Black background reads with the in-app dark palette; white/transparent (usually
    // dropped onto light surfaces) need the dark-glyph light palette.
    const palette = bg === 'black' ? EQUATION_PREVIEW_PALETTE_DARK : EQUATION_PREVIEW_PALETTE_LIGHT;
    const fg = foregroundColorFor(bg);
    const relationSymbol = RELATION_DISPLAY[equation.relation ?? '='] ?? '=';

    return (
      <div
        ref={ref}
        data-testid="equation-export-canvas"
        style={{
          backgroundColor: backgroundColorFor(bg),
          color: fg,
          // The equation row carries lineHeight 1.1, so ~0.65rem of phantom leading
          // sits below its glyphs. With branding that leading lands in the gap, making
          // "above" read larger than the 1rem bottom; shrink the gap to cancel it.
          // Without branding the same leading pushes the equation visually high, so
          // trim the bottom padding to re-centre it (#335 feedback).
          padding: branding ? '2.5rem 2rem 1rem' : '2.5rem 2rem 1.9rem',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: branding ? '0.35rem' : '1rem',
        }}
      >
        <EquationPreviewPaletteContext.Provider value={palette}>
          <div
            className="flex items-center justify-center gap-[0.35em] flex-nowrap"
            style={{ fontSize: '2.75rem', lineHeight: 1.1 }}
          >
            <PreviewEquationNode path="lhs" customEquation={equation} />
            <span className={`font-mono ${palette.relation}`}>{relationSymbol}</span>
            <PreviewEquationNode path="rhs" customEquation={equation} />
          </div>
        </EquationPreviewPaletteContext.Provider>
        {branding && (
          <div className="flex items-center gap-1 select-none" style={{ color: fg, opacity: 0.55 }}>
            <Image
              src="/logo-mark.png"
              alt=""
              width={24}
              height={24}
              unoptimized
              priority
              style={{ display: 'block', width: '1.6rem', height: '1.6rem' }}
            />
            <span className="font-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.04em' }}>
              algebranch.org
            </span>
          </div>
        )}
      </div>
    );
  },
);
