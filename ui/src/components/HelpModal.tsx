// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, ExternalLink, BookOpen, Keyboard, Info, Github } from 'lucide-react';
import { helpModalOpenAtom, shortcutsOverlayOpenAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { USER_GUIDE_URL, FAQ_URL, SCOPE_URL, FEATURES_URL, GITHUB_REPO_URL } from '../constants/about';
import { trackEvent } from '../utils/analytics';

export const HelpModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(helpModalOpenAtom);
  const setShortcutsOverlayOpen = useSetAtom(shortcutsOverlayOpenAtom);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore.
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const handleOpenShortcuts = () => {
    setIsOpen(false);
    setShortcutsOverlayOpen(true);
    trackEvent({ action: 'help_open_shortcuts', category: 'interaction' });
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-lg overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <HelpCircle className="text-indigo-400 w-5 h-5" />
                <h2 id="help-modal-title" className="text-lg font-bold text-white tracking-wide">Help</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5 text-sm text-zinc-300 leading-relaxed">
              {/* Informational Message */}
              <div className="flex gap-3 text-xs leading-relaxed border-l-2 border-indigo-500/30 pl-3.5 py-0.5 select-none shrink-0">
                <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-zinc-200">Documentation</span>
                  <span className="text-zinc-400">
                    Our detailed guides live on algebranch.org, rendered from the version-controlled source. Select a guide below to open it in a new tab:
                  </span>
                </div>
              </div>

              {/* Resource Links Cards */}
              <div className="flex flex-col gap-3">
                <a
                  href={USER_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent({ action: 'help_read_user_guide', category: 'help' })}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <BookOpen size={18} className="text-indigo-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">User Guide</span>
                      <span className="text-xs text-zinc-400 mt-0.5">Interaction model, transposing, simplify handles, and global operations.</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-3" />
                </a>

                <a
                  href={FAQ_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent({ action: 'help_read_faq', category: 'help' })}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">FAQ Reference</span>
                      <span className="text-xs text-zinc-400 mt-0.5">Common questions about blocked moves, root branching, and privacy.</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-3" />
                </a>

                <a
                  href={SCOPE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent({ action: 'help_read_scope', category: 'help' })}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Info size={18} className="text-indigo-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">Mathematical Scope</span>
                      <span className="text-xs text-zinc-400 mt-0.5">What algebraic operations, presets, and functions Algebranch supports.</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-3" />
                </a>

                <a
                  href={FEATURES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent({ action: 'help_read_features', category: 'help' })}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <BookOpen size={18} className="text-indigo-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">Features Reference</span>
                      <span className="text-xs text-zinc-400 mt-0.5">Full index of every algebraic transform, setting, and global operation.</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                </a>
              </div>

              {/* Keyboard Shortcuts Prompt */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs select-none">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-white">Keyboard Shortcuts</span>
                  <span className="text-zinc-400">View shortcuts for history, workspaces, and navigation.</span>
                </div>
                <button
                  onClick={handleOpenShortcuts}
                  className={`px-3 py-2 text-xs font-bold ${THEME_GLASS.BUTTON_SECONDARY} flex items-center gap-1.5 shrink-0 cursor-pointer`}
                >
                  <Keyboard size={13} />
                  <span>Press K</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-between items-center mt-5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 select-none shrink-0`}>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${THEME_GLASS.LINK} flex items-center gap-1.5`}
              >
                <Github size={14} className="shrink-0" />
                GitHub Repository
              </a>
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
