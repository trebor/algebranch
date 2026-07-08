// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { MoreVertical, Settings as SettingsIcon, Info, HelpCircle, Keyboard, Github } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';

interface HeaderOverflowMenuProps {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  onOpenShortcuts: () => void;
}

export const HeaderOverflowMenu: React.FC<HeaderOverflowMenuProps> = ({
  onOpenSettings,
  onOpenAbout,
  onOpenHelp,
  onOpenShortcuts,
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

  const handleShortcutsClick = () => {
    setOpen(false);
    onOpenShortcuts();
    trackEvent({ action: 'overflow_open_shortcuts', category: 'interaction' });
  };

  const handleGitHubClick = () => {
    // The anchor navigates on its own (new tab); just close the menu and log.
    setOpen(false);
    trackEvent({ action: 'overflow_open_github', category: 'interaction' });
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
        // Each item echoes its global keyboard shortcut as a trailing keycap so
        // users can learn them. The glyphs mirror the bare-key bindings declared
        // in page.tsx (Settings `,`, Help `?`, Shortcuts `K`, About `A`); GitHub
        // has no shortcut. Keycaps are aria-hidden so they never leak into a menu
        // item's accessible name.
        <div role="menu" className={THEME_GLASS.OVERFLOW_MENU}>
          <button
            type="button"
            role="menuitem"
            onClick={handleSettingsClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <SettingsIcon size={14} className={THEME_GLASS.HEADER_ICON_SETTINGS} />
            <span>Settings</span>
            <kbd aria-hidden="true" className={`ml-auto ${THEME_GLASS.SHORTCUT_KEYCAP_SM}`}>,</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleHelpClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <HelpCircle size={14} className="text-indigo-400" />
            <span>Help</span>
            <kbd aria-hidden="true" className={`ml-auto ${THEME_GLASS.SHORTCUT_KEYCAP_SM}`}>?</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleShortcutsClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Keyboard size={14} className="text-indigo-400" />
            <span>Shortcuts</span>
            <kbd aria-hidden="true" className={`ml-auto ${THEME_GLASS.SHORTCUT_KEYCAP_SM}`}>K</kbd>
          </button>
          <a
            role="menuitem"
            href="https://github.com/trebor/algebranch"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleGitHubClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Github size={14} className="text-indigo-400" />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={handleAboutClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Info size={14} className={THEME_GLASS.HEADER_ICON_ABOUT} />
            <span>About</span>
            <kbd aria-hidden="true" className={`ml-auto ${THEME_GLASS.SHORTCUT_KEYCAP_SM}`}>A</kbd>
          </button>
        </div>
      )}
    </div>
  );
};
