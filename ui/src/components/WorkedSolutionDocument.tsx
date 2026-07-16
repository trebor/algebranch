// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import Image from 'next/image';
import type { Equation } from 'math-engine-client';
import type { DerivationStep } from '../store/equation';
import {
  EQUATION_PREVIEW_PALETTE_LIGHT,
  EQUATION_PREVIEW_PALETTE_DARK,
  type EquationPreviewPalette,
} from '../constants/theme';
import { EquationPreviewPaletteContext } from './EquationPreviewPaletteContext';
import { PreviewEquationNode } from './PreviewEquationNode';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { type ImageBackground, backgroundColorFor } from '../utils/equationImage';

/**
 * The rendered worked-solution page (#130): a numbered, typeset derivation meant
 * to be printed, saved as PDF, or captured to a PNG and pasted into Docs — the
 * artifact a student hands in and a teacher reuses as an answer key.
 *
 * This is the single capture/print target the dialog wraps. It composes the same
 * structured steps as the text transcript (`getDerivationSteps`), so the document
 * and the copied text never diverge. Rendering flows through `PreviewEquationNode`
 * so the math looks exactly like the app (app-consistent render doubles as
 * branding); a later KaTeX migration is isolated to this one component.
 *
 * Colours are declared inline rather than pulled from the app's dark THEME_GLASS
 * tokens: this surface is a physical deliverable (print / PDF / rasterized image)
 * where app-theme CSS variables don't apply. The document theme follows the chosen
 * export background so the derivation image has the same White / Black / Transparent
 * parity the single-equation export has (#335) — black reads as a dark page with
 * light ink, white/transparent as a light page with dark ink.
 */

interface WorkedSolutionDocumentProps {
  readonly steps: readonly DerivationStep[];
  /** When true, each step shows its justification + assumptions; off = clean chain. */
  readonly annotated: boolean;
  /** When true, an algebranch.org footer is appended (matches the image export). */
  readonly branding: boolean;
  /** Export background; drives the page theme. Defaults to white (light page). */
  readonly bg?: ImageBackground;
  /** The presentation mode variant. Solution (default) or worksheet with blanks. */
  readonly variant?: 'solution' | 'worksheet';
  /** The prefix step count to reveal (presentation mode). */
  readonly revealedCount?: number;
}

// Ink/muted/rule/accent per theme. Light = dark-on-white page; dark = light-on-black.
const DOC_THEME = {
  light: { ink: '#0f172a', muted: '#64748b', rule: '#e2e8f0', accent: '#4f46e5', palette: EQUATION_PREVIEW_PALETTE_LIGHT },
  dark: { ink: '#f1f5f9', muted: '#94a3b8', rule: '#334155', accent: '#818cf8', palette: EQUATION_PREVIEW_PALETTE_DARK },
} as const;

/** One typeset equation line: lhs <relation> rhs, using the app's preview renderer. */
const EquationLine: React.FC<{ equation: Equation; fontSize: string; ink: string }> = ({ equation, fontSize, ink }) => {
  const relation = RELATION_DISPLAY[equation.relation ?? '='] ?? '=';
  return (
    <div
      className="flex items-center justify-start gap-[0.35em] flex-nowrap"
      style={{ fontSize, lineHeight: 1.15 }}
    >
      <PreviewEquationNode path="lhs" customEquation={equation} />
      <span className="font-mono font-medium" style={{ color: ink }}>
        {relation}
      </span>
      <PreviewEquationNode path="rhs" customEquation={equation} />
    </div>
  );
};

export const WorkedSolutionDocument = React.forwardRef<HTMLDivElement, WorkedSolutionDocumentProps>(
  function WorkedSolutionDocument({ steps, annotated, branding, bg = 'white', variant = 'solution', revealedCount }, ref) {
    const problem = steps[0]?.equation;
    const t: { ink: string; muted: string; rule: string; accent: string; palette: EquationPreviewPalette } =
      bg === 'black' ? DOC_THEME.dark : DOC_THEME.light;

    const isWorksheet = variant === 'worksheet';
    const visibleSteps = isWorksheet
      ? steps
      : (revealedCount !== undefined ? steps.slice(0, revealedCount) : steps);

    return (
      <EquationPreviewPaletteContext.Provider value={t.palette}>
        <div
          ref={ref}
          data-worked-solution-document=""
          data-testid="worked-solution-document"
          style={{
            backgroundColor: backgroundColorFor(bg),
            color: t.ink,
            padding: '2.5rem 2.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
            minWidth: 'min-content',
          }}
        >
          {/* Problem prompt — the original equation, named so the page reads as a
              solvable question before its worked answer. */}
          {problem && (
            <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span
                style={{
                  color: t.accent,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Solve
              </span>
              <EquationLine equation={problem} fontSize="1.9rem" ink={t.ink} />
            </header>
          )}

          {/* Numbered working. Step 1 is the given equation (no justification); each
              later row carries its reason + any domain assumptions when annotated. */}
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 0, listStyle: 'none', margin: 0, padding: 0 }}>
            {visibleSteps.map((step, i) => {
              const isFirstStep = i === 0;
              const showBlank = isWorksheet && !isFirstStep;

              return (
                <li
                  key={step.index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '0.85rem 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.rule}`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: t.accent,
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      minWidth: '1.5rem',
                      textAlign: 'right',
                      paddingTop: '0.35rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {step.index}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
                    {showBlank ? (
                      <div
                        data-testid="ruled-blank"
                        style={{
                          height: '2.2rem',
                          width: '18rem',
                          borderBottom: `1px solid ${t.rule}`,
                          marginTop: '0.2rem',
                        }}
                      />
                    ) : (
                      <>
                        <EquationLine equation={step.equation} fontSize="1.55rem" ink={t.ink} />
                        {!isWorksheet && annotated && step.justification && (
                          <div style={{ color: t.muted, fontSize: '0.9rem', lineHeight: 1.4 }}>
                            {step.justification}
                            {step.assumptions?.length ? (
                              <span style={{ fontStyle: 'italic' }}> — assuming {step.assumptions.join(', ')}</span>
                            ) : null}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {branding && (
            <footer
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: t.muted,
                borderTop: `1px solid ${t.rule}`,
                paddingTop: '1rem',
              }}
            >
              <Image
                src="/logo-mark.png"
                alt=""
                width={22}
                height={22}
                unoptimized
                priority
                style={{ display: 'block', width: '1.4rem', height: '1.4rem' }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                algebranch.org
              </span>
            </footer>
          )}
        </div>
      </EquationPreviewPaletteContext.Provider>
    );
  },
);
