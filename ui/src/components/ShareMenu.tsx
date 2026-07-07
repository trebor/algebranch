// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Check, Variable, Layers, Route, ChevronDown } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { trackEvent } from '../utils/analytics';
import { safeCopyText } from '../utils/clipboard';
import { safeStorage } from '../utils/safeStorage';
import { encodeEqParam } from '../utils/eqParam';
import type { ShareScope } from '../store/equation';

const COPIED_TIMEOUT = 2000;
const MENU_CLOSE_GRACE = 500;
const HINT_DURATION = 4000;

/** A derivation this deep is "worth sending" — fires the one-time share hint. */
export const SHARE_HINT_STEP_THRESHOLD = 4;
/** localStorage key marking the right-moment share hint as already shown. */
export const SHARE_HINT_FLAG = 'algebranch_share_hint_shown';

// Link-size characterization (#439): a raw char count is noise — what a user
// needs is whether the link pastes cleanly. ≤280 fits a QR code or a tweet;
// ≤2,000 is the real-world safe-URL ceiling; beyond that some chat apps and
// QR encoders may trim it. We translate the computed length into that advice.
const LINK_SIZE_TINY = 280;
const LINK_SIZE_SAFE = 2000;

interface LinkBand {
  label: string;
  tone: 'ok' | 'warn';
}
export const classifyLinkSize = (n: number): LinkBand =>
  n <= LINK_SIZE_TINY
    ? { label: 'Tiny', tone: 'ok' }
    : n <= LINK_SIZE_SAFE
      ? { label: 'Compact', tone: 'ok' }
      : { label: 'Large', tone: 'warn' };

/** The qualitative band + muted exact count shown beside each menu item. */
const SizeBadge: React.FC<{ size: number | null }> = ({ size }) => {
  if (size === null) return null;
  const band = classifyLinkSize(size);
  return (
    <span className={THEME_GLASS.SHARE_SIZE_BADGE}>
      <span
        className={
          band.tone === 'warn'
            ? THEME_GLASS.SHARE_SIZE_BADGE_WARN
            : THEME_GLASS.SHARE_SIZE_BADGE_OK
        }
      >
        {band.label} link
      </span>
      <span className={THEME_GLASS.SHARE_SIZE_BADGE_COUNT}>{`${size.toLocaleString()} chars`}</span>
    </span>
  );
};

/** Text-tone class for a link-size band — amber warns, emerald reassures. */
const bandToneClass = (n: number): string =>
  classifyLinkSize(n).tone === 'warn'
    ? THEME_GLASS.SHARE_SIZE_BADGE_WARN
    : THEME_GLASS.SHARE_SIZE_BADGE_OK;

/** A leader-chord rendered as keycap chips joined by "then" (e.g. C then W). */
const SequenceChips: React.FC<{ keys: string[]; className?: string }> = ({ keys, className = '' }) => (
  <span className={`flex items-center gap-0.5 shrink-0 ${className}`}>
    {keys.map((k, i) => (
      <React.Fragment key={`${k}-${i}`}>
        {i > 0 && <span className="text-white/40 text-[0.5rem]">then</span>}
        <kbd className={THEME_GLASS.SHORTCUT_KEYCAP_SM}>{k}</kbd>
      </React.Fragment>
    ))}
  </span>
);

interface ShareMenuProps {
  /** The current equation string (to build the eq share link). */
  equationString: string;
  /** Async function or string returning the compressed workspace state (#439 scope). */
  getCompressedWorkspace: (scope: ShareScope) => Promise<string> | string;
  /** Number of real transformation steps in the active derivation (#241 hint). */
  derivationStepCount?: number;
  /** Lucide icon pixel size. */
  iconSize?: number;
  /** Fallback text for the primary pill tooltip before char-count is computed. */
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
  // True while the pill is hovered — arms the size computation so the primary
  // tooltip can show the link's size band on plain hover, before the menu opens.
  const [hovered, setHovered] = React.useState(false);
  // Computed URL character counts — populated async when the menu opens so each
  // item can show "· N chars" without blocking the open interaction.
  const [linkSizes, setLinkSizes] = React.useState<{
    full: number | null;
    path: number | null;
    eq: number | null;
  }>({ full: null, path: null, eq: null });
  // Has the one-time hint already been spent? Seed from the persisted flag so it
  // never re-fires across reloads; treat unavailable storage as "spent" (no hint).
  const [hintConsumed, setHintConsumed] = React.useState<boolean>(
    () => safeStorage.getItem(SHARE_HINT_FLAG) === 'true',
  );
  const reducedMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref so the size-computation effect always calls the latest prop
  // without needing to be listed as a dependency (avoids spurious refetches
  // when the parent re-renders with a new inline arrow).
  const gcwRef = React.useRef(getCompressedWorkspace);
  React.useLayoutEffect(() => { gcwRef.current = getCompressedWorkspace; });

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

  // Compute URL character counts once the pill is hovered or the menu opens, so
  // each item — and the primary tooltip — can show its size band. All three
  // sizes are set together when the async workspace/path compressions resolve;
  // they persist afterward so re-hovers don't re-compress needlessly.
  React.useEffect(() => {
    if (!open && !hovered) return;
    const base = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    const eqSize = (equationString ? `${base}?eq=${encodeEqParam(equationString)}` : base).length;
    let cancelled = false;
    Promise.all([
      Promise.resolve(gcwRef.current('full')),
      Promise.resolve(gcwRef.current('path')),
    ]).then(([fullWs, pathWs]) => {
      if (cancelled) return;
      setLinkSizes({
        full: `${base}?ws=${fullWs}`.length,
        path: `${base}?ws=${pathWs}`.length,
        eq: eqSize,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, hovered, equationString]);

  // Right-moment hint (#241): once the derivation is substantial, pulse the
  // Share pill *once ever* to nudge "you have a worked solution worth sending".
  // Suppressed under prefers-reduced-motion; the one-time flag survives reloads.
  const showHint =
    !reducedMotion && !hintConsumed && derivationStepCount >= SHARE_HINT_STEP_THRESHOLD;

  // While the pulse is live, persist the one-time flag and auto-dismiss it.
  React.useEffect(() => {
    if (!showHint) return;
    // Private mode / disabled storage degrades to in-memory, so the pulse still
    // won't re-fire this session even when the persistent write is rejected.
    safeStorage.setItem(SHARE_HINT_FLAG, 'true');
    const t = setTimeout(() => setHintConsumed(true), HINT_DURATION);
    return () => clearTimeout(t);
  }, [showHint]);

  const handleMouseEnter = () => {
    clearCloseTimer();
    setHovered(true);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), MENU_CLOSE_GRACE);
  };

  const baseUrl = () =>
    `${window.location.protocol}//${window.location.host}${window.location.pathname}`;

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_TIMEOUT);
  };

  const handleShareEquation = () => {
    clearCloseTimer();
    setOpen(false);
    setHintConsumed(true);
    try {
      const shareUrl = equationString ? `${baseUrl()}?eq=${encodeEqParam(equationString)}` : baseUrl();
      safeCopyText(shareUrl).then((success) => {
        if (success) {
          flashCopied();
          trackEvent({ action: 'share_equation_link', category: 'interaction' });
        }
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleShareWorkspaceLink = async (scope: ShareScope) => {
    clearCloseTimer();
    setOpen(false);
    setHintConsumed(true);
    try {
      const compressed = await getCompressedWorkspace(scope);
      const shareUrl = `${baseUrl()}?ws=${compressed}`;
      safeCopyText(shareUrl).then((success) => {
        if (success) {
          flashCopied();
          trackEvent({ action: 'share_workspace_link', category: 'interaction', label: scope });
        }
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const derivationDesc = `${derivationStepCount} step${derivationStepCount !== 1 ? 's' : ''}`;

  const primaryButton = (
    <button
      type="button"
      onClick={() => handleShareWorkspaceLink('full')}
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
          {/* Layers glyph + explicit scope, matching the workspace menu item so
              the button reads as "this copies the workspace" (#439). */}
          <Layers size={iconSize} className="text-indigo-300 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Share workspace</span>
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
        <Tooltip
          content={
            // Two stacked lines so the size band and the chord each stay short —
            // a single nowrap line overran the tooltip's max width (#439).
            <span className="flex flex-col items-center gap-1 whitespace-nowrap">
              <span>
                {linkSizes.full !== null ? (
                  <>
                    <span className={bandToneClass(linkSizes.full)}>
                      {`${classifyLinkSize(linkSizes.full).label} link`}
                    </span>
                    <span className="text-white/50">{` · ${linkSizes.full.toLocaleString()} chars`}</span>
                  </>
                ) : (
                  (tooltip ?? 'Share workspace')
                )}
              </span>
              <SequenceChips keys={['C', 'W']} />
            </span>
          }
          position={tooltipPosition}
          autoAlign={false}
        >
          {primaryButton}
        </Tooltip>
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
          {/* Workspace share — full tree, the largest link. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShareWorkspaceLink('full')}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_GLASS.SHARE_MENU_ITEM_PRIMARY} ${THEME_TRANSITIONS.FAST}`}
          >
            <Layers size={14} className="mt-0.5 shrink-0 text-indigo-300" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Share workspace</span>
                <SequenceChips keys={['C', 'W']} className="opacity-60" />
              </span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>All branches and steps</span>
              <SizeBadge size={linkSizes.full} />
            </span>
          </button>
          {/* Derivation share — root → current node only, a shorter link. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShareWorkspaceLink('path')}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Route size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Share derivation</span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>{derivationDesc}</span>
              <SizeBadge size={linkSizes.path} />
            </span>
          </button>
          {/* Equation share — just the starting equation, the smallest link. */}
          <button
            type="button"
            role="menuitem"
            onClick={handleShareEquation}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Variable size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Share equation</span>
                <SequenceChips keys={['C', 'L']} className="opacity-60" />
              </span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>Just the starting equation</span>
              <SizeBadge size={linkSizes.eq} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
