// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Share2, Check, Variable, Layers } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';

const COPIED_TIMEOUT = 2000;
const MENU_CLOSE_GRACE = 500;

interface ShareMenuProps {
  /** The current equation string (to build the eq share link). */
  equationString: string;
  /** Async function or string returning the compressed workspace state. */
  getCompressedWorkspace: () => Promise<string> | string;
  /** Lucide icon pixel size. */
  iconSize?: number;
  /** Class names for the trigger button. */
  triggerClassName: string;
  /** Tooltip label for the trigger. */
  tooltip?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({
  equationString,
  getCompressedWorkspace,
  iconSize = 14,
  triggerClassName,
  tooltip,
  tooltipPosition = 'bottom',
  disabled,
}) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
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

  const handleMouseEnter = () => {
    clearCloseTimer();
  };
  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), MENU_CLOSE_GRACE);
  };

  const handleShareEquation = () => {
    clearCloseTimer();
    setOpen(false);
    
    try {
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      const encodeSafe = (s: string) =>
        encodeURIComponent(s).replace(/[()*!']/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      const shareUrl = equationString ? `${baseUrl}?eq=${encodeSafe(equationString)}` : baseUrl;

      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        trackEvent({ action: 'share_equation_link', category: 'interaction' });
        setTimeout(() => setCopied(false), COPIED_TIMEOUT);
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleShareWorkspace = async () => {
    clearCloseTimer();
    setOpen(false);

    try {
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      const compressed = await getCompressedWorkspace();
      const shareUrl = `${baseUrl}?ws=${compressed}`;

      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        trackEvent({ action: 'share_workspace_link', category: 'interaction' });
        setTimeout(() => setCopied(false), COPIED_TIMEOUT);
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleTriggerClick = () => {
    setOpen((v) => !v);
  };

  const trigger = (
    <button
      type="button"
      onClick={handleTriggerClick}
      disabled={disabled}
      aria-haspopup="menu"
      aria-expanded={open}
      className={triggerClassName}
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
      {tooltip ? (
        <Tooltip content={tooltip} position={tooltipPosition} visible={open ? false : undefined} autoAlign={false}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      {open && (
        <div role="menu" className={THEME_GLASS.COPY_MENU}>
          <div className={THEME_GLASS.COPY_MENU_HEADER}>
            <span className={THEME_GLASS.COPY_MENU_HEADER_LABEL}>Create Share Link</span>
          </div>
          <Tooltip
            content={<HotkeyHint label="Copy equation link" keys="⇧S" />}
            position="left"
            autoAlign={false}
            wrapperClassName="w-full"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleShareEquation}
              className={`${THEME_GLASS.COPY_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
            >
              <span>Share Equation</span>
              <Variable size={12} className="text-indigo-400/70" />
            </button>
          </Tooltip>
          <Tooltip
            content={<HotkeyHint label="Copy workspace link" keys="S" />}
            position="left"
            autoAlign={false}
            wrapperClassName="w-full"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleShareWorkspace}
              className={`${THEME_GLASS.COPY_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
            >
              <span>Share Workspace</span>
              <Layers size={12} className="text-indigo-400/70" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
