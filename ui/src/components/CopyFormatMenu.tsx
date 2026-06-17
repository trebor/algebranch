// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import type { ExportFormat } from '../store/equation';

// A copy button that opens a small popover to choose the export format (#46):
// plain ASCII, LaTeX, or display-ready Unicode. Encapsulates clipboard write,
// the transient "copied" check, analytics, and outside-click/Escape dismissal so
// each copy site is a one-liner.

// Ordered simplest → most complex: plain ASCII, then pretty Unicode, then LaTeX markup.
const FORMAT_OPTIONS: { format: ExportFormat; label: string }[] = [
  { format: 'plain', label: 'Plain text' },
  { format: 'unicode', label: 'Unicode' },
  { format: 'latex', label: 'LaTeX' },
];

const COPIED_TIMEOUT = 2000;
// Grace before a click-opened menu closes after the cursor leaves it, so clipping
// the edge doesn't dismiss it.
const MENU_CLOSE_GRACE = 500;

interface CopyFormatMenuProps {
  /** Returns the text to copy for the chosen format. */
  getText: (format: ExportFormat) => string;
  /** Lucide icon pixel size (matches the surrounding affordance). */
  iconSize?: number;
  /** Class names for the trigger button (varies per call site). */
  triggerClassName: string;
  /** Class applied to the trigger while showing the copied state. */
  copiedClassName?: string;
  /** Tooltip label for the trigger. Omit to skip the tooltip (e.g. when the menu's own header already names the action). */
  tooltip?: string;
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
  /** Secondary header line, e.g. the endpoint equation that defines the path (#46). */
  scopeDetail?: string;
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
  triggerClassName,
  copiedClassName,
  tooltip,
  tooltipPosition,
  disabled,
  trackAction,
  trackCategory,
  trackLabel,
  stopPropagation,
  scopeLabel,
  scopeDetail,
  onPreviewChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSelect = (e: React.MouseEvent, format: ExportFormat) => {
    if (stopPropagation) e.stopPropagation();
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

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    setOpen((v) => !v);
  };

  const trigger = (
    <button
      type="button"
      onClick={handleTriggerClick}
      disabled={disabled}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`${triggerClassName} ${copied && copiedClassName ? copiedClassName : ''}`}
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
      {tooltip ? (
        // Suppress the hover tooltip once the menu is open, so it isn't shown
        // doubled-up over the menu — the menu's own header takes over from there.
        <Tooltip content={tooltip} position={tooltipPosition} visible={open ? false : undefined}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      {open && (
        <div role="menu" className={THEME_GLASS.COPY_MENU}>
          {(scopeLabel || scopeDetail) && (
            <div className={THEME_GLASS.COPY_MENU_HEADER}>
              {scopeLabel && <span className={THEME_GLASS.COPY_MENU_HEADER_LABEL}>{scopeLabel}</span>}
              {scopeDetail && <span className={THEME_GLASS.COPY_MENU_HEADER_EXPR}>{scopeDetail}</span>}
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
