// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sliders, Info, Download, Keyboard } from 'lucide-react';
import {
  settingsModalOpenAtom,
  settingsAtom,
  aboutModalOpenAtom,
  pwaInstallPromptAtom,
  shortcutsOverlayOpenAtom,
} from '../store/equation';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import Link from 'next/link';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const SettingsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(settingsModalOpenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const setAboutOpen = useSetAtom(aboutModalOpenAtom);
  const setShortcutsOverlayOpen = useSetAtom(shortcutsOverlayOpenAtom);
  const [installPrompt, setInstallPrompt] = useAtom(pwaInstallPromptAtom);
  const setConsent = useSetAtom(consentAtom);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    try {
      const promptEvent = installPrompt as BeforeInstallPromptEvent;
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      trackEvent({
        action: 'install_pwa',
        category: 'settings',
        label: outcome,
      });
      setInstallPrompt(null);
    } catch (err) {
      console.error('Failed to trigger PWA install prompt:', err);
    }
  };

  // Escape key handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, setIsOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleToggleEvaluateToDecimal = () => {
    const newVal = !settings.allowEvaluateToDecimal;
    setSettings((prev) => ({
      ...prev,
      allowEvaluateToDecimal: newVal,
    }));
    trackEvent({
      action: 'toggle_evaluate_to_decimal',
      category: 'settings',
      label: newVal ? 'on' : 'off',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-5 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <Sliders className="text-indigo-400 w-5 h-5" />
                <h2 className="text-lg font-bold text-white tracking-wide">Settings</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex flex-col gap-5 overflow-y-auto pr-1">
              <div className={THEME_GLASS.SETTING_ROW}>
                <div className="flex flex-col gap-1 select-none">
                  <span className="text-sm font-semibold text-white">
                    Evaluate to Decimal
                  </span>
                  <span className={`text-[11px] leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                    Allow simplifying constant subtrees to decimal floats (e.g. 3/4 → 0.75). Turn off to keep responses in exact fractional forms.
                  </span>
                </div>
                
                <button
                  onClick={handleToggleEvaluateToDecimal}
                  className={`${THEME_GLASS.TOGGLE_TRACK} ${
                    settings.allowEvaluateToDecimal
                      ? THEME_GLASS.TOGGLE_TRACK_ON
                      : THEME_GLASS.TOGGLE_TRACK_OFF
                  }`}
                  role="switch"
                  aria-checked={settings.allowEvaluateToDecimal}
                  aria-label="Toggle evaluate to decimal option"
                >
                  <span
                    className={`${THEME_GLASS.TOGGLE_KNOB} ${
                      settings.allowEvaluateToDecimal ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className={THEME_GLASS.SETTING_ROW}>
                <div className="flex flex-col gap-1 select-none">
                  <span className="text-sm font-semibold text-white">
                    Keyboard Shortcuts
                  </span>
                  <span className={`text-[11px] leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                    View every shortcut for navigating history, workspaces, and panels. Press <kbd className={`${THEME_GLASS.SHORTCUT_KEYCAP} !h-5 !min-w-[1.25rem] !px-1.5`}>?</kbd> any time.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShortcutsOverlayOpen(true);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 text-xs font-bold ${THEME_GLASS.BUTTON_SECONDARY} flex items-center gap-1.5 shrink-0 self-center`}
                >
                  <Keyboard size={13} />
                  <span>View</span>
                </button>
              </div>

              {!!installPrompt && (
                <div className={THEME_GLASS.SETTING_ROW}>
                  <div className="flex flex-col gap-1 select-none">
                    <span className="text-sm font-semibold text-white">
                      Install Algebranch
                    </span>
                    <span className={`text-[11px] leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                      Install Algebranch to your device for offline use, standalone window, and faster startup.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstallApp}
                    className={`px-3 py-2 text-xs font-bold ${THEME_GLASS.BUTTON_PRIMARY} flex items-center gap-1.5 shrink-0 self-center`}
                  >
                    <Download size={13} />
                    <span>Install</span>
                  </button>
                </div>
              )}

              <div className={THEME_GLASS.SETTING_ROW}>
                <div className="flex flex-col gap-1 select-none">
                  <span className="text-sm font-semibold text-white">
                    Privacy & Cookies
                  </span>
                  <span className={`text-[11px] leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                    Review what anonymous analytics data we collect or update your cookie tracking preferences.
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 self-center">
                  <Link
                    href="/privacy"
                    onClick={() => setIsOpen(false)}
                    className={`${THEME_GLASS.LINK} text-xs font-bold text-center no-underline`}
                  >
                    Privacy Policy
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setConsent('unset');
                      setIsOpen(false);
                    }}
                    className={`${THEME_GLASS.LINK} text-xs font-bold bg-transparent border-none cursor-pointer p-0 text-center`}
                  >
                    Cookie Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-between items-center gap-3 mt-6 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 select-none shrink-0`}>
              <button
                onClick={() => {
                  setAboutOpen(true);
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Info size={12} />
                <span>About Algebranch</span>
              </button>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY}`}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
