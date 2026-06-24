// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { MoreVertical, Settings as SettingsIcon, Info, HelpCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';

interface HeaderOverflowMenuProps {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
}

export const HeaderOverflowMenu: React.FC<HeaderOverflowMenuProps> = ({
  onOpenSettings,
  onOpenAbout,
  onOpenHelp,
}) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

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

  const handleSettingsClick = () => {
    setOpen(false);
    onOpenSettings();
    trackEvent({ action: 'overflow_open_settings', category: 'interaction' });
  };

  const handleHelpClick = () => {
    setOpen(false);
    onOpenHelp();
    trackEvent({ action: 'overflow_open_help', category: 'interaction' });
  };

  const handleAboutClick = () => {
    setOpen(false);
    onOpenAbout();
    trackEvent({ action: 'overflow_open_about', category: 'interaction' });
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Tooltip content="More options" position="bottom" autoAlign={false}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More options"
          className={THEME_GLASS.OVERFLOW_TRIGGER}
        >
          <MoreVertical
            size={14}
            className={THEME_GLASS.HEADER_ICON_ABOUT}
          />
        </button>
      </Tooltip>

      {open && (
        <div role="menu" className={THEME_GLASS.OVERFLOW_MENU}>
          <button
            type="button"
            role="menuitem"
            onClick={handleSettingsClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <SettingsIcon size={14} className={THEME_GLASS.HEADER_ICON_SETTINGS} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleHelpClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <HelpCircle size={14} className="text-indigo-400" />
            <span>Help</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleAboutClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Info size={14} className={THEME_GLASS.HEADER_ICON_ABOUT} />
            <span>About</span>
          </button>
        </div>
      )}
    </div>
  );
};
