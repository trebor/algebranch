// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { X, Info, ExternalLink, Shield, Github } from 'lucide-react';
import { aboutModalOpenAtom } from '../store/equation';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  APP_VERSION,
  COPYRIGHT_NOTICE,
  THIRD_PARTY_ATTRIBUTIONS,
  GPL_LICENSE_TEXT,
  GITHUB_REPO_URL
} from '../constants/about';

export const AboutModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(aboutModalOpenAtom);
  const setConsent = useSetAtom(consentAtom);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore.
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

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
            aria-labelledby="about-modal-title"
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
                <Info className="text-indigo-400 w-5 h-5" />
                <h2 id="about-modal-title" className="text-lg font-bold text-white tracking-wide">About Algebranch</h2>
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
              {/* App Meta & Description */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
                <Image
                  src="/logo.png"
                  alt="Algebranch Logo"
                  width={115}
                  height={115}
                  unoptimized
                  className="h-[115px] w-[115px] object-contain rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] shrink-0"
                />
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2">
                    <span className="text-xl font-extrabold text-white tracking-wide">Algebranch</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className={`text-xs ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                    An interactive, pedagogical workspace for step-by-step algebraic derivations, equation transpositions, and visual mathematical exploration.
                  </p>
                  <p className="text-xs text-zinc-400">
                    {COPYRIGHT_NOTICE} · Released under the GNU General Public License (GPLv3).
                  </p>
                </div>
              </div>

              {/* GPLv3 License text area */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-white/60 font-semibold flex items-center gap-1.5">
                  <Shield size={12} className="text-indigo-400" />
                  GNU General Public License (GPLv3)
                </span>
                <div className="max-h-36 overflow-y-auto font-mono text-xs bg-neutral-950/60 p-3 rounded-xl border border-white/5 text-zinc-400 leading-normal scrollbar-thin">
                  <pre className="whitespace-pre-wrap font-mono">{GPL_LICENSE_TEXT}</pre>
                </div>
              </div>

              {/* Third-Party OSS Attributions */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs text-white/60 font-semibold">
                  Third-Party Open Source Software
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THIRD_PARTY_ATTRIBUTIONS.map((item) => (
                    <div
                      key={item.name}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{item.name}</span>
                        <span className={`text-xs ${THEME_GLASS.TEXT_MUTED} font-semibold`}>
                          {item.license} License
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md text-zinc-500 group-hover:text-indigo-400 group-hover:bg-white/5 transition-all"
                        aria-label={`Visit ${item.name} homepage`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-between items-center mt-5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 select-none shrink-0`}>
              <div className="flex items-center gap-3">
                <Link
                  href="/privacy"
                  onClick={() => setIsOpen(false)}
                  className={THEME_GLASS.LINK}
                >
                  Privacy Policy
                </Link>
                <button
                  onClick={() => {
                    setConsent('unset');
                    setIsOpen(false);
                  }}
                  className={`${THEME_GLASS.LINK} bg-transparent border-none cursor-pointer`}
                >
                  Cookie Settings
                </button>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${THEME_GLASS.LINK} flex items-center gap-1.5`}
                >
                  <Github size={14} className="shrink-0" />
                  GitHub
                </a>
              </div>
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
