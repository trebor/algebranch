// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { THEME_GLASS } from '../constants/theme';
import { PreviewEquationNode } from './PreviewEquationNode';

/**
 * Division-by-zero warning, shown on the two surfaces that flag it (#416). The
 * two tooltips deliberately DIVERGE, because they answer different questions:
 *
 *  - Inline, on the offending subtree in the canvas (EquationNode): the learner
 *    is looking AT one sub-expression, so the tooltip previews exactly that `/0`
 *    term and explains why it's inert. The word "branch" is meaningless for a
 *    sub-expression, so it never appears here.
 *  - History-tree node badge (WorkspaceTreeView): the learner is looking at a
 *    whole equation state that may contain several `/0` terms, so the tooltip is
 *    generic — it says this state is a dead end without singling out a subtree.
 *    The history genuinely IS a tree, so "branch" is the right word there.
 *
 * Both still name the same condition ("division by zero") and share the tooltip
 * chrome, so the two messages read as siblings rather than as unrelated copy.
 */

/** Accessible name for the inline handle — announced by screen readers / TTS. */
export const UNDEFINED_INLINE_LABEL = 'Undefined: division by zero in this term';

/** Accessible name for the history-tree badge. */
export const UNDEFINED_HISTORY_LABEL = 'Undefined: division by zero in this branch';

const TooltipShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={THEME_GLASS.UNDEFINED_TOOLTIP}>
    <TriangleAlert size={14} className={THEME_GLASS.UNDEFINED_TOOLTIP_ICON} aria-hidden="true" />
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

/**
 * Inline tooltip: names the condition, previews the exact `/0` sub-expression at
 * `path`, and explains it in sub-expression terms (no "branch").
 */
export const UndefinedInlineTooltipContent: React.FC<{ path: string }> = ({ path }) => (
  <TooltipShell>
    <span className={THEME_GLASS.UNDEFINED_TOOLTIP_TITLE}>Undefined — division by zero</span>
    <div data-testid="undefined-subtree-preview" className={THEME_GLASS.UNDEFINED_TOOLTIP_PREVIEW}>
      <PreviewEquationNode path={path} />
    </div>
    <span className={THEME_GLASS.UNDEFINED_TOOLTIP_BODY}>
      Dividing by zero has no value, so this term can’t be simplified or moved.
    </span>
  </TooltipShell>
);

/**
 * History tooltip: generic dead-end message for the whole equation state — no
 * subtree preview, "branch" is apt because the history is a tree.
 */
export const UndefinedHistoryTooltipContent: React.FC = () => (
  <TooltipShell>
    <span className={THEME_GLASS.UNDEFINED_TOOLTIP_TITLE}>Undefined — division by zero</span>
    <span className={THEME_GLASS.UNDEFINED_TOOLTIP_BODY}>
      This branch divides by zero, so it’s a dead end — undo to try another path.
    </span>
  </TooltipShell>
);
