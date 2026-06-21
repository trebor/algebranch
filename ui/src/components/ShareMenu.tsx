// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Share2, Check, Variable, Layers, ChevronDown } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { trackEvent } from '../utils/analytics';

const COPIED_TIMEOUT = 2000;
const MENU_CLOSE_GRACE = 500;
const HINT_DURATION = 4000;

/** A derivation this deep is "worth sending" — fires the one-time share hint. */
export const SHARE_HINT_STEP_THRESHOLD = 4;
/** localStorage key marking the right-moment share hint as already shown. */
export const SHARE_HINT_FLAG = 'algebranch_share_hint_shown';

interface ShareMenuProps {
  /** The current equation string (to build the eq share link). */
  equationString: string;
  /** Async function or string returning the compressed workspace state. */
  getCompressedWorkspace: () => Promise<string> | string;
  /** Number of real transformation steps in the active derivation (#241 hint). */
  derivationStepCount?: number;
  /** Lucide icon pixel size. */
  iconSize?: number;
  /** Tooltip label for the primary trigger. */
  tooltip?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({
  equationString,
  getCompressedWorkspace,
  derivationStepCount = 0,
  iconSize = 14,
  tooltip,
  tooltipPosition = 'bottom',
  disabled,
}) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  // Has the one-time hint already been spent? Seed from the persisted flag so it
  // never re-fires across reloads; treat unavailable storage as "spent" (no hint).
  const [hintConsumed, setHintConsumed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(SHARE_HINT_FLAG) === 'true';
    } catch {
      return true;
    }
  });
  const reducedMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  React.useEffect(() => clearCloseTimer, []);

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

  // Right-moment hint (#241): once the derivation is substantial, pulse the
  // Share pill *once ever* to nudge "you have a worked solution worth sending".
  // Suppressed under prefers-reduced-motion; the one-time flag survives reloads.
  const showHint =
    !reducedMotion && !hintConsumed && derivationStepCount >= SHARE_HINT_STEP_THRESHOLD;

  // While the pulse is live, persist the one-time flag and auto-dismiss it.
  React.useEffect(() => {
    if (!showHint) return;
    try {
      localStorage.setItem(SHARE_HINT_FLAG, 'true');
    } catch {
      // Private mode / disabled storage — the pulse still shows this session.
    }
    const t = setTimeout(() => setHintConsumed(true), HINT_DURATION);
    return () => clearTimeout(t);
  }, [showHint]);

  const handleMouseEnter = () => {
    clearCloseTimer();
  };
  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), MENU_CLOSE_GRACE);
  };

  const baseUrl = () =>
    `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
  const encodeSafe = (s: string) =>
    encodeURIComponent(s).replace(/[()*!']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_TIMEOUT);
  };

  const handleShareEquation = () => {
    clearCloseTimer();
    setOpen(false);
    setHintConsumed(true);
    try {
      const shareUrl = equationString ? `${baseUrl()}?eq=${encodeSafe(equationString)}` : baseUrl();
      navigator.clipboard.writeText(shareUrl).then(() => {
        flashCopied();
        trackEvent({ action: 'share_equation_link', category: 'interaction' });
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleShareWorkspace = async () => {
    clearCloseTimer();
    setOpen(false);
    setHintConsumed(true);
    try {
      const compressed = await getCompressedWorkspace();
      const shareUrl = `${baseUrl()}?ws=${compressed}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        flashCopied();
        trackEvent({ action: 'share_workspace_link', category: 'interaction' });
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const primaryButton = (
    <button
      type="button"
      onClick={handleShareWorkspace}
      disabled={disabled}
      aria-label="Share workspace link"
      className={THEME_GLASS.SHARE_PILL_PRIMARY}
    >
      {copied ? (
        <>
          <Check size={iconSize} className="text-emerald-400" />
          <span className="text-emerald-400 font-bold hidden sm:inline">Link Copied!</span>
        </>
      ) : (
        <>
          <Share2 size={iconSize} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={THEME_GLASS.SHARE_PILL}>
        {showHint && (
          <span data-share-hint aria-hidden="true" className={THEME_GLASS.SHARE_HINT_PULSE} />
        )}
        {tooltip ? (
          <Tooltip content={tooltip} position={tooltipPosition} autoAlign={false}>
            {primaryButton}
          </Tooltip>
        ) : (
          primaryButton
        )}
        <span aria-hidden="true" className={THEME_GLASS.SHARE_PILL_DIVIDER} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More sharing options"
          className={THEME_GLASS.SHARE_PILL_CARET}
        >
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div role="menu" className={THEME_GLASS.SHARE_MENU}>
          <div className={THEME_GLASS.COPY_MENU_HEADER}>
            <span className={THEME_GLASS.COPY_MENU_HEADER_LABEL}>Create Share Link</span>
          </div>
          <Tooltip
            content={<HotkeyHint label="Copy workspace link" sequence={['C', 'W']} />}
            position="left"
            autoAlign={false}
            wrapperClassName="w-full"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleShareWorkspace}
              className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_GLASS.SHARE_MENU_ITEM_PRIMARY} ${THEME_TRANSITIONS.FAST}`}
            >
              <Layers size={14} className="mt-0.5 shrink-0 text-indigo-300" />
              <span className="flex flex-col gap-0.5">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Share workspace</span>
                <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>
                  Opens your full derivation and history
                </span>
              </span>
            </button>
          </Tooltip>
          <Tooltip
            content={<HotkeyHint label="Copy equation link" sequence={['C', 'L']} />}
            position="left"
            autoAlign={false}
            wrapperClassName="w-full"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleShareEquation}
              className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
            >
              <Variable size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
              <span className="flex flex-col gap-0.5">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Share equation</span>
                <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>
                  Just the starting equation
                </span>
              </span>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
