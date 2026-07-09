// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Check, Variable, Layers, Route, ChevronDown, WifiOff, Loader2 } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { trackEvent } from '../utils/analytics';
import { safeCopyText } from '../utils/clipboard';
import { safeStorage } from '../utils/safeStorage';
import { encodeEqParam } from '../utils/eqParam';
import { createShareLink } from '../utils/shareLink';
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
// QR encoders may trim it. Since #481 short links are constant-size, this only
// characterizes the self-contained "works offline" links, where length still bites.
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

/**
 * Actionable advice for a link length (#405). Returns an explanation only for the
 * WARN band — naming *why* a large link is risky — and `null` for the safe bands,
 * so callers render nothing when the link pastes cleanly everywhere. When a smaller
 * self-contained link exists below this one (`hasSmallerScope`), it nudges toward it
 * in plain words (#481 — no "narrower scope" jargon); the smallest one omits that
 * clause since nothing below it would shrink the link.
 */
export const bandAdvice = (
  n: number,
  { hasSmallerScope = true }: { hasSmallerScope?: boolean } = {},
): string | null => {
  if (classifyLinkSize(n).tone !== 'warn') return null;
  const risk = 'This link may be trimmed by some chat apps and QR encoders.';
  return hasSmallerScope ? `${risk} A smaller link is below.` : risk;
};

/**
 * The advice sentence (#405) rendered inside an offline menu item when *that item's*
 * own link lands in the warn band — so the explanation sits with the large link and
 * its containment is unambiguous. `role="note"` so screen readers announce it.
 */
const ItemAdvice: React.FC<{ size: number | null; hasSmallerScope: boolean }> = ({
  size,
  hasSmallerScope,
}) => {
  const advice = size === null ? null : bandAdvice(size, { hasSmallerScope });
  if (!advice) return null;
  return (
    <span role="note" className={THEME_GLASS.SHARE_MENU_ADVICE}>
      {advice}
    </span>
  );
};

/** The qualitative band + muted exact count shown beside each offline menu item. */
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
  /** Fallback text for the primary pill tooltip. */
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
  // True during a short-link create round-trip (encrypt → POST → build link), so the
  // pill can show a "Creating link…" state while the server call is in flight.
  const [creating, setCreating] = React.useState(false);
  // Is the "works offline" section expanded? Collapsed by default so the recommended
  // short links lead and the self-contained links stay out of the way (#481).
  const [offlineOpen, setOfflineOpen] = React.useState(false);
  // Did the last short-link attempt fail while online (server unreachable / over the
  // size cap)? When so we do *not* silently copy a long URL — we surface it and steer
  // the user to the offline links, so the long link is only ever a conscious pick.
  const [shortLinkError, setShortLinkError] = React.useState(false);
  // Computed URL character counts for the offline rows — populated async when that
  // section is expanded, so each self-contained item can show its size band without
  // blocking. Only the offline links have variable size worth characterizing.
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
  // Short links need a server round-trip; when the network is down we don't want to
  // silently hand back a long fallback URL. Instead we disable the short-link rows
  // and steer the user to the self-contained "works offline" links (#481).
  const online = useOnlineStatus();
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

  // Toggle the dropdown. On a fresh open, collapse the offline disclosure when online
  // (lead with the recommended short links) but auto-expand it when offline — where
  // the short links are disabled and the offline choices are the only path (#481).
  const toggleMenu = () => {
    if (!open) {
      setOfflineOpen(!online);
      setShortLinkError(false);
    }
    setOpen((v) => !v);
  };

  // The pill's headline action mints a full-workspace short link — but offline that
  // would just fall back to a long URL behind the user's back. So offline the pill
  // opens the menu (offline section expanded) and lets them choose consciously.
  const handlePrimaryPill = () => {
    if (!online) {
      clearCloseTimer();
      setOfflineOpen(true);
      setOpen(true);
      return;
    }
    handleShareShort('full');
  };

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

  // Compute the self-contained URL char counts once the offline section is expanded,
  // so each of its rows can show a size band. All three are set together when the
  // async workspace/path compressions resolve; they persist afterward so a re-expand
  // doesn't re-compress needlessly.
  React.useEffect(() => {
    if (!offlineOpen) return;
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
  }, [offlineOpen, equationString]);

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

  const handleMouseEnter = () => clearCloseTimer();
  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), MENU_CLOSE_GRACE);
  };

  const baseUrl = () =>
    `${window.location.protocol}//${window.location.host}${window.location.pathname}`;

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_TIMEOUT);
  };

  // Short link (#480/#481): encrypt the scoped workspace client-side, POST the
  // ciphertext, and copy a tiny first-party `/s#key` link (~38 chars, constant size).
  // Every primary row + the pill routes here. On failure we deliberately copy
  // *nothing*: rather than silently swap in a giant self-contained URL the user could
  // paste unaware, we surface the failure and expand the offline links, so the long
  // link is only ever a conscious pick (#481). Every primary row + the pill routes here.
  const handleShareShort = async (scope: ShareScope) => {
    clearCloseTimer();
    setHintConsumed(true);
    setShortLinkError(false);
    setCreating(true);
    try {
      const compressed = await Promise.resolve(getCompressedWorkspace(scope));
      const origin = `${window.location.protocol}//${window.location.host}`;
      const result = await createShareLink(compressed, origin);
      if (result.status === 'ok') {
        const success = await safeCopyText(result.url);
        if (success) {
          setOpen(false);
          flashCopied();
          trackEvent({ action: 'share_short_link', category: 'interaction', label: scope });
        }
        return;
      }
      // Couldn't mint a short link — surface it and steer to the offline links.
      setShortLinkError(true);
      setOfflineOpen(true);
      setOpen(true);
      trackEvent({ action: 'share_short_link_failed', category: 'interaction', label: scope });
    } catch (err) {
      console.error('Failed to create short link:', err);
      setShortLinkError(true);
      setOfflineOpen(true);
      setOpen(true);
    } finally {
      setCreating(false);
    }
  };

  // Offline delivery: copy a self-contained `?ws=` link (full or path scope) that
  // needs no server round-trip — the "works offline" affordance (#481).
  const handleShareWorkspaceOffline = async (scope: ShareScope) => {
    clearCloseTimer();
    setOpen(false);
    setHintConsumed(true);
    try {
      const compressed = await Promise.resolve(getCompressedWorkspace(scope));
      const success = await safeCopyText(`${baseUrl()}?ws=${compressed}`);
      if (success) {
        flashCopied();
        trackEvent({ action: 'share_workspace_link', category: 'interaction', label: scope });
      }
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  // Offline equation delivery: a self-contained `?eq=` link, the smallest and only
  // link that never needs a backend at all.
  const handleShareEquationOffline = () => {
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

  const derivationDesc = `${derivationStepCount} step${derivationStepCount !== 1 ? 's' : ''}`;

  const primaryButton = (
    <button
      type="button"
      onClick={handlePrimaryPill}
      disabled={disabled}
      aria-label="Share workspace link"
      className={THEME_GLASS.SHARE_PILL_PRIMARY}
    >
      {creating ? (
        <>
          <Loader2 size={iconSize} className="text-indigo-300 animate-spin" />
          <span className="hidden sm:inline">Creating link…</span>
        </>
      ) : copied ? (
        <>
          <Check size={iconSize} className="text-emerald-400" />
          <span className="text-emerald-400 font-bold hidden sm:inline">Link Copied!</span>
        </>
      ) : !online ? (
        <>
          <WifiOff size={iconSize} className="text-amber-300/90" />
          <span className="hidden sm:inline">Share workspace</span>
        </>
      ) : (
        <>
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
            !online ? (
              <span className="whitespace-nowrap">Offline — pick a link that works offline</span>
            ) : (
              <span className="flex flex-col items-center gap-1 whitespace-nowrap">
                <span>{tooltip ?? 'Share workspace'}</span>
                <SequenceChips keys={['C', 'W']} />
              </span>
            )
          }
          position={tooltipPosition}
          autoAlign={false}
        >
          {primaryButton}
        </Tooltip>
        <span aria-hidden="true" className={THEME_GLASS.SHARE_PILL_DIVIDER} />
        <button
          type="button"
          onClick={toggleMenu}
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
            <span className={THEME_GLASS.COPY_MENU_HEADER_LABEL}>Share</span>
          </div>

          {/* Heads-up note (#481): either the network is down (short links disabled)
              or a mint just failed. Either way, name why and point at the offline
              choices below — so a long link is only ever a conscious pick. */}
          {(!online || shortLinkError) && (
            <span role="note" className={THEME_GLASS.SHARE_MENU_OFFLINE_NOTE}>
              {!online
                ? "You're offline. Short links need a connection — use a link that works offline below."
                : "Couldn't create a short link. Use a link that works offline below."}
            </span>
          )}

          {/* Primary rows (#481): one opaque short link per scope — the same tiny
              /s link shape everywhere, so there is one thing to recognize. Disabled
              when offline, where the short-link server can't be reached. */}
          <button
            type="button"
            role="menuitem"
            disabled={!online}
            onClick={() => handleShareShort('full')}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Layers size={14} className="mt-0.5 shrink-0 text-indigo-300" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Whole workspace</span>
                <SequenceChips keys={['C', 'W']} className="opacity-60" />
              </span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>Every branch and step</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!online}
            onClick={() => handleShareShort('path')}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Route size={14} className="mt-0.5 shrink-0 text-indigo-300" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>This derivation</span>
                <SequenceChips keys={['C', 'D']} className="opacity-60" />
              </span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>Your path from start to here</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!online}
            onClick={() => handleShareShort('equation')}
            className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Variable size={14} className="mt-0.5 shrink-0 text-indigo-300" />
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Just the equation</span>
                <SequenceChips keys={['C', 'E']} className="opacity-60" />
              </span>
              <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>The equation on its own</span>
            </span>
          </button>

          <span aria-hidden="true" className={THEME_GLASS.SHARE_MENU_DIVIDER} />

          {/* Offline section (#481): the self-contained links, collapsed by default so
              they stay out of the way. This is the only place the #439/#405 size-band
              machinery still lives — short links make it moot on the primary path. */}
          <button
            type="button"
            role="menuitem"
            aria-expanded={offlineOpen}
            onClick={() => setOfflineOpen((v) => !v)}
            className={
              online && !shortLinkError
                ? THEME_GLASS.SHARE_MENU_SECTION_TOGGLE
                : THEME_GLASS.SHARE_MENU_SECTION_TOGGLE_ACTIVE
            }
          >
            <span className="flex items-center gap-1.5">
              <WifiOff size={12} className="shrink-0" />
              Links that work offline
            </span>
            <ChevronDown
              size={12}
              className={`shrink-0 transition-transform ${offlineOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {offlineOpen && (
            <>
              <button
                type="button"
                role="menuitem"
                aria-label="Offline workspace link"
                onClick={() => handleShareWorkspaceOffline('full')}
                className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
              >
                <Layers size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
                <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Whole workspace</span>
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>Every branch and step</span>
                  <SizeBadge size={linkSizes.full} />
                  <ItemAdvice size={linkSizes.full} hasSmallerScope />
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Offline derivation link"
                onClick={() => handleShareWorkspaceOffline('path')}
                className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
              >
                <Route size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
                <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>This derivation</span>
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>{derivationDesc}</span>
                  <SizeBadge size={linkSizes.path} />
                  <ItemAdvice size={linkSizes.path} hasSmallerScope />
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Offline equation link"
                onClick={handleShareEquationOffline}
                className={`${THEME_GLASS.SHARE_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
              >
                <Variable size={14} className="mt-0.5 shrink-0 text-indigo-400/70" />
                <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_TITLE}>Just the equation</span>
                  <span className={THEME_GLASS.SHARE_MENU_ITEM_DESC}>The equation on its own</span>
                  <SizeBadge size={linkSizes.eq} />
                  <ItemAdvice size={linkSizes.eq} hasSmallerScope={false} />
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
