import React from 'react';
import { Equation } from 'math-engine-client';
import { PreviewEquationNode } from './PreviewEquationNode';
import { THEME_GLASS } from '../constants/theme';

export interface TooltipCardProps {
  /** Small uppercase category/kind label at the top-left. */
  readonly eyebrow?: React.ReactNode;
  /** Small muted detail at the top-right (e.g. "Step 3"). */
  readonly meta?: React.ReactNode;
  /** Main title (workspace/tab name, preset label). */
  readonly title?: React.ReactNode;
  /** Optional supporting description line. */
  readonly description?: React.ReactNode;
  /** Equation rendered in pretty (typeset) form. */
  readonly equation?: Equation | null;
  /** Raw equation string shown if `equation` is absent (parse fallback). */
  readonly rawEquation?: string;
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
  equation,
  rawEquation,
  footer,
}) => (
  <div className="flex flex-col gap-2 text-left">
    {(eyebrow || meta) && (
      <div className={`flex items-center justify-between gap-8 border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-1.5`}>
        {eyebrow ? <span className={THEME_GLASS.TOOLTIP_EYEBROW}>{eyebrow}</span> : <span />}
        {meta && <span className={`${THEME_GLASS.TEXT_MUTED_EXTRA} text-[9px] font-medium`}>{meta}</span>}
      </div>
    )}
    {title && <span className={THEME_GLASS.TOOLTIP_TITLE}>{title}</span>}
    {description && <span className={THEME_GLASS.TOOLTIP_DESC}>{description}</span>}
    {equation ? (
      <div className={`flex items-center justify-center gap-2 py-1 overflow-x-auto ${THEME_GLASS.TOOLTIP_EQUATION}`}>
        <PreviewEquationNode path="lhs" customEquation={equation} />
        <span className={`px-2 ${THEME_GLASS.TOOLTIP_EQ_SEP}`}>=</span>
        <PreviewEquationNode path="rhs" customEquation={equation} />
      </div>
    ) : rawEquation ? (
      <span className={THEME_GLASS.TOOLTIP_RAW_EQ}>{rawEquation}</span>
    ) : null}
    {footer && (
      <div className={`${THEME_GLASS.TEXT_MUTED} text-[10px] flex items-center justify-between gap-4 pt-0.5`}>
        {footer}
      </div>
    )}
  </div>
);
