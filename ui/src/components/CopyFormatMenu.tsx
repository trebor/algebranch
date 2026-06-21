// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import type { Equation } from 'math-engine-client';
import { Tooltip } from './Tooltip';
import { PreviewEquationNode } from './PreviewEquationNode';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import type { ExportFormat } from '../store/equation';

// A copy split-button (#46, #243): the primary segment copies the default format
// in one gesture, and a caret reveals the full Plain / Unicode / LaTeX menu.
// Encapsulates clipboard write, the transient "copied" check, analytics, the
// typeset header preview, and outside-click/Escape dismissal so each copy site
// is a one-liner. Mirrors the ShareMenu split-button (#241).

// Ordered simplest → most complex: plain ASCII, then pretty Unicode, then LaTeX markup.
const FORMAT_OPTIONS: { format: ExportFormat; label: string }[] = [
  { format: 'plain', label: 'Plain text' },
  { format: 'unicode', label: 'Unicode' },
  { format: 'latex', label: 'LaTeX' },
];

// Display-ready Unicode is what the cards render, so it's the least-surprising
// thing a one-click primary copy hands you (#243).
const DEFAULT_FORMAT: ExportFormat = 'unicode';

const COPIED_TIMEOUT = 2000;
// Grace before a click-opened menu closes after the cursor leaves it, so clipping
// the edge doesn't dismiss it.
const MENU_CLOSE_GRACE = 500;

// Two sizes of the same split-button: roomy in the derivation toolbar, compact in
// the per-step hover toolbar on a history card.
const VARIANTS = {
  panel: {
    container: THEME_GLASS.COPY_SPLIT_PANEL,
    primary: THEME_GLASS.COPY_SPLIT_PANEL_PRIMARY,
    divider: THEME_GLASS.COPY_SPLIT_PANEL_DIVIDER,
    caret: THEME_GLASS.COPY_SPLIT_PANEL_CARET,
    caretSize: 12,
  },
  tree: {
    container: THEME_GLASS.COPY_SPLIT_TREE,
    primary: THEME_GLASS.COPY_SPLIT_TREE_PRIMARY,
    divider: THEME_GLASS.COPY_SPLIT_TREE_DIVIDER,
    caret: THEME_GLASS.COPY_SPLIT_TREE_CARET,
    caretSize: 9,
  },
} as const;

interface CopyFormatMenuProps {
  /** Returns the text to copy for the chosen format. */
  getText: (format: ExportFormat) => string;
  /** Lucide icon pixel size for the primary copy glyph. */
  iconSize?: number;
  /** Size preset selecting the centralized split-button tokens. */
  variant: keyof typeof VARIANTS;
  /** Tooltip content for the primary copy button. Omit to skip the tooltip. */
  tooltip?: React.ReactNode;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  /** Analytics action + label, e.g. 'copy_derivation'. Format is appended to the label. */
  trackAction: string;
  trackCategory: string;
  trackLabel: string;
  /** Stop propagation on the trigger (per-step button sits on a clickable card). */
  stopPropagation?: boolean;
  /** Menu header naming the slice being copied, e.g. "7 steps" or "This step" (#46). */
  scopeLabel?: string;
  /** Equation to render typeset in the menu header — names *which* equation is copied (#243). */
  scopeEquation?: Equation;
  /**
   * Fired while the trigger is hovered or the menu is open (#46), so a caller can
   * illuminate the export path in the tree. Kept as a callback to keep this
   * component decoupled from app state.
   */
  onPreviewChange?: (active: boolean) => void;
}

export const CopyFormatMenu: React.FC<CopyFormatMenuProps> = ({
  getText,
  iconSize = 16,
  variant,
  tooltip,
  tooltipPosition,
  disabled,
  trackAction,
  trackCategory,
  trackLabel,
  stopPropagation,
  scopeLabel,
  scopeEquation,
  onPreviewChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const v = VARIANTS[variant];

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  React.useEffect(() => clearCloseTimer, []);

  // Preview the export path only while the trigger/menu is hovered, so moving the
  // mouse away (or selecting an item, which clears `hovered`) stops the animation
  // immediately rather than lingering. Cleanup clears it on unmount too.
  React.useEffect(() => {
    onPreviewChange?.(hovered);
    return () => onPreviewChange?.(false);
  }, [hovered, onPreviewChange]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Stop the path animation immediately when the cursor leaves, but let the menu
  // itself linger briefly so clipping its edge doesn't dismiss it.
  const handleMouseEnter = () => {
    clearCloseTimer();
    setHovered(true);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), MENU_CLOSE_GRACE);
  };

  const copy = (format: ExportFormat) => {
    // Close the menu and drop the hover/preview so the path animation stops on copy.
    clearCloseTimer();
    setOpen(false);
    setHovered(false);
    navigator.clipboard.writeText(getText(format)).then(() => {
      setCopied(true);
      trackEvent({ action: trackAction, category: trackCategory, label: `${trackLabel}:${format}` });
      setTimeout(() => setCopied(false), COPIED_TIMEOUT);
    });
  };

  const handleSelect = (e: React.MouseEvent, format: ExportFormat) => {
    if (stopPropagation) e.stopPropagation();
    copy(format);
  };

  const handlePrimaryClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    copy(DEFAULT_FORMAT);
  };

  const handleCaretClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    setOpen((value) => !value);
  };

  const primaryButton = (
    <button
      type="button"
      onClick={handlePrimaryClick}
      disabled={disabled}
      className={v.primary}
      aria-label={copied ? 'Copied' : 'Copy equation'}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`${v.container} ${copied ? THEME_GLASS.COPY_SPLIT_COPIED : ''}`}>
        {tooltip ? (
          // Suppress the hover tooltip once the menu is open, so it isn't shown
          // doubled-up over the menu — the menu's own header takes over from there.
          <Tooltip content={tooltip} position={tooltipPosition} visible={open ? false : undefined}>
            {primaryButton}
          </Tooltip>
        ) : (
          primaryButton
        )}
        <span aria-hidden="true" className={v.divider} />
        <button
          type="button"
          onClick={handleCaretClick}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Copy format options"
          className={v.caret}
        >
          <ChevronDown size={v.caretSize} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div role="menu" className={THEME_GLASS.COPY_MENU}>
          {(scopeLabel || scopeEquation) && (
            <div className={THEME_GLASS.COPY_MENU_HEADER}>
              {scopeLabel && <span className={THEME_GLASS.COPY_MENU_HEADER_LABEL}>{scopeLabel}</span>}
              {scopeEquation && (
                <div className={THEME_GLASS.COPY_MENU_HEADER_PREVIEW}>
                  <div className={THEME_GLASS.COPY_MENU_HEADER_PREVIEW_ROW}>
                    <PreviewEquationNode path="lhs" customEquation={scopeEquation} />
                    <span className={THEME_GLASS.COPY_MENU_HEADER_PREVIEW_SEP}>=</span>
                    <PreviewEquationNode path="rhs" customEquation={scopeEquation} />
                  </div>
                </div>
              )}
            </div>
          )}
          {FORMAT_OPTIONS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={(e) => handleSelect(e, format)}
              className={`${THEME_GLASS.COPY_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
