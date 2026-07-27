// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  MoreVertical,
  Settings as SettingsIcon,
  Info,
  HelpCircle,
  Keyboard,
  Github,
  Download,
  Upload,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import {
  exportWorkspacesModalOpenAtom,
  importWorkspacesModalOpenAtom,
  pwaInstallPromptAtom,
} from '../store/equation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

  const setExportWorkspacesOpen = useSetAtom(exportWorkspacesModalOpenAtom);
  const setImportWorkspacesOpen = useSetAtom(importWorkspacesModalOpenAtom);
  const [installPrompt, setInstallPrompt] = useAtom(pwaInstallPromptAtom);

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

  const handleImportClick = () => {
    setOpen(false);
    setImportWorkspacesOpen(true);
    trackEvent({ action: 'overflow_open_import', category: 'interaction' });
  };

  const handleExportClick = () => {
    setOpen(false);
    setExportWorkspacesOpen(true);
    trackEvent({ action: 'overflow_open_export', category: 'interaction' });
  };

  const handleInstallClick = async () => {
    setOpen(false);
    if (!installPrompt) return;
    try {
      const promptEvent = installPrompt as BeforeInstallPromptEvent;
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      trackEvent({
        action: 'install_pwa',
        category: 'header_overflow',
        label: outcome,
      });
      setInstallPrompt(null);
    } catch (err) {
      console.error('Failed to trigger PWA install prompt:', err);
    }
  };

  const handleHelpClick = () => {
    setOpen(false);
    onOpenHelp();
    trackEvent({ action: 'overflow_open_help', category: 'interaction' });
  };

  const handleShortcutsClick = () => {
    setOpen(false);
    onOpenShortcuts();
    trackEvent({ action: 'overflow_open_shortcuts', category: 'interaction' });
  };

  const handleAboutClick = () => {
    setOpen(false);
    onOpenAbout();
    trackEvent({ action: 'overflow_open_about', category: 'interaction' });
  };

  const handleGitHubClick = () => {
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
        <div role="menu" className={`${THEME_GLASS.OVERFLOW_MENU} !w-48`}>
          {/* Section 1: Configuration & Data */}
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
            onClick={handleImportClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Download size={14} className="text-indigo-400" />
            <span>Import Workspaces</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleExportClick}
            className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
          >
            <Upload size={14} className="text-indigo-400" />
            <span>Export Workspaces</span>
          </button>
          {!!installPrompt && (
            <button
              type="button"
              role="menuitem"
              onClick={handleInstallClick}
              className={`${THEME_GLASS.OVERFLOW_MENU_ITEM} ${THEME_TRANSITIONS.FAST}`}
            >
              <Download size={14} className="text-indigo-400" />
              <span>Install App</span>
            </button>
          )}

          <div role="separator" className="my-1 border-t border-white/10" />

          {/* Section 2: Guidance */}
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

          <div role="separator" className="my-1 border-t border-white/10" />

          {/* Section 3: Meta & Links */}
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
        </div>
      )}
    </div>
  );
};

