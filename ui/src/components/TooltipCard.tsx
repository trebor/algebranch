// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { TriangleAlert, ExternalLink } from 'lucide-react';
import { Equation } from 'math-engine-client';
import { PreviewEquationNode } from './PreviewEquationNode';
import { THEME_GLASS } from '../constants/theme';

export interface TooltipCardProps {
  /** Small category/kind label at the top-left. */
  readonly eyebrow?: React.ReactNode;
  /** Small muted detail at the top-right (e.g. "Step 3"). */
  readonly meta?: React.ReactNode;
  /** Main title (workspace/tab name, preset label). */
  readonly title?: React.ReactNode;
  /** Optional supporting description line. */
  readonly description?: React.ReactNode;
  /** Domain restrictions the step assumes (#63), e.g. ['x ≠ 0']. Surfaced as a
   *  prominent caveat row so an assumed non-zero condition can't slip by unseen. */
  readonly assumptions?: readonly string[];
  /** Equation rendered in pretty (typeset) form. */
  readonly equation?: Equation | null;
  /** Raw equation string shown if `equation` is absent (parse fallback). */
  readonly rawEquation?: string;
  /** Optional Wikipedia reference URL. */
  readonly wikiUrl?: string;
  /** Optional footer row (e.g. step count / last used). */
  readonly footer?: React.ReactNode;
}

/**
 * Unified tooltip content used across workspaces, tabs, the equation library,
 * and history steps so every "entity" tooltip feels the same: an eyebrow label,
 * optional title/description, and a (large) typeset equation. Width is governed
 * by the Tooltip wrapper; this only lays out the content.
 */
export const TooltipCard: React.FC<TooltipCardProps> = ({
  eyebrow,
  meta,
  title,
  description,
  assumptions,
  equation,
  rawEquation,
  wikiUrl,
  footer,
}) => (
  <div className="flex flex-col gap-2 text-left">
    {(eyebrow || meta) && (
      <div className={`flex items-center justify-between gap-8 border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-1.5`}>
        {eyebrow ? <span className={THEME_GLASS.TOOLTIP_EYEBROW}>{eyebrow}</span> : <span />}
        {meta && <span className={`${THEME_GLASS.TEXT_MUTED_EXTRA} text-[0.5625rem] font-medium`}>{meta}</span>}
      </div>
    )}
    {title && <span className={THEME_GLASS.TOOLTIP_TITLE}>{title}</span>}
    {equation ? (
      <div className="w-full max-w-full overflow-x-auto scrollbar-thin flex justify-start">
        <div className={`flex items-center gap-2 py-1 mx-auto min-w-max ${THEME_GLASS.TOOLTIP_EQUATION}`}>
          <PreviewEquationNode path="lhs" customEquation={equation} />
          <span className={`px-2 ${THEME_GLASS.TOOLTIP_EQ_SEP}`}>=</span>
          <PreviewEquationNode path="rhs" customEquation={equation} />
        </div>
      </div>
    ) : rawEquation ? (
      <span className={THEME_GLASS.TOOLTIP_RAW_EQ}>{rawEquation}</span>
    ) : null}
    {description && (
      typeof description === 'string' ? (
        <div className={THEME_GLASS.TOOLTIP_DESC}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="leading-relaxed mb-1">{children}</p>,
              ul: ({ children }) => <ul className="flex flex-col gap-1 pl-3.5 list-disc text-zinc-300 my-1">{children}</ul>,
              li: ({ children }) => <li className="leading-snug text-xs">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
            }}
          >
            {description}
          </ReactMarkdown>
        </div>
      ) : (
        <span className={THEME_GLASS.TOOLTIP_DESC}>{description}</span>
      )
    )}
    {assumptions && assumptions.length > 0 && (
      <span className={THEME_GLASS.TOOLTIP_ASSUMPTION}>
        <TriangleAlert size={12} className={THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} />
        <span>assuming {assumptions.join(', ')}</span>
      </span>
    )}
    {(footer || wikiUrl) && (
      <div className={`${THEME_GLASS.TEXT_MUTED} text-xs flex items-center justify-between gap-4 pt-0.5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} mt-1`}>
        {footer ? <div>{footer}</div> : <div />}
        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${THEME_GLASS.LINK} flex items-center gap-1 text-[0.6875rem] font-medium shrink-0 ml-auto`}
          >
            <span>Wikipedia Reference</span>
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    )}
  </div>
);
