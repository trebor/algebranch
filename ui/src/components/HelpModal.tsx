// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import Link from 'next/link';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  HelpCircle,
  ArrowRight,
  BookOpen,
  BookText,
  Keyboard,
  Info,
  Github,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { helpModalOpenAtom, shortcutsOverlayOpenAtom, activeHelpDocAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { GITHUB_REPO_URL } from '../constants/about';
import { trackEvent } from '../utils/analytics';
import { NAV_SECTIONS, type NavEntry } from '../constants/docsPages';

// Menu-local presentation for each nav entry: the icon, a short launcher blurb,
// and the analytics action, keyed by route href. Everything a reader compares
// against /docs — the set of pages, their grouping, order, and titles — comes
// from NAV_SECTIONS, so the launcher can't drift from the routes (it used to
// invent "Mathematical Scope" / "FAQ Reference" in its own order). An entry
// without a blurb here still appears, falling back to its route description.
const CARD_META: Record<string, { icon: typeof BookOpen; description: string; action: string }> = {
  '/user-guide': {
    icon: BookOpen,
    description: 'Interaction model, transposing, simplify handles, and global operations.',
    action: 'help_read_user_guide',
  },
  '/scope': {
    icon: Info,
    description: 'What algebraic operations, presets, and functions Algebranch supports.',
    action: 'help_read_scope',
  },
  '/features': {
    icon: BookOpen,
    description: 'Full index of every algebraic transform, setting, and global operation.',
    action: 'help_read_features',
  },
  '/faq': {
    icon: HelpCircle,
    description: 'Common questions about blocked moves, root branching, and privacy.',
    action: 'help_read_faq',
  },
  '/privacy': {
    icon: ShieldCheck,
    description: 'What we collect, cookieless analytics, consent, and unreadable share links.',
    action: 'help_open_privacy',
  },
  '/school-privacy': {
    icon: GraduationCap,
    description: 'For teachers and districts: the COPPA and FERPA posture, no accounts, no records.',
    action: 'help_open_school_privacy',
  },
};

const actionFor = (entry: NavEntry): string =>
  CARD_META[entry.href]?.action ??
  `help_open_${entry.href.replace(/^\//, '').replace(/-/g, '_')}`;

const CARD_CLASS =
  'flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all group cursor-pointer text-left';

// The icon + title + blurb shared by both card shapes (a modal-opening button and
// a route-navigating link), so the two render identically.
const CardInner: React.FC<{ entry: NavEntry }> = ({ entry }) => {
  const Icon = CARD_META[entry.href]?.icon ?? BookOpen;
  const description = CARD_META[entry.href]?.description ?? entry.description;
  return (
    <>
      <div className="flex items-center gap-3.5">
        <Icon size={18} className="text-indigo-400 shrink-0" />
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
            {entry.title}
          </span>
          <span className="text-xs text-zinc-400 mt-0.5">{description}</span>
        </div>
      </div>
      <ArrowRight
        size={14}
        className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-3"
      />
    </>
  );
};

export const HelpModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(helpModalOpenAtom);
  const setShortcutsOverlayOpen = useSetAtom(shortcutsOverlayOpenAtom);
  const setActiveHelpDoc = useSetAtom(activeHelpDocAtom);

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

  // Open a guide in the in-app DocModal (#514): close this launcher and set the
  // active-doc atom. DocModal renders it in place and syncs the URL to the
  // crawlable `/<slug>` via the History API, so the address stays shareable.
  const handleOpenDoc = (slug: string, action: string) => {
    setIsOpen(false);
    setActiveHelpDoc(slug);
    trackEvent({ action, category: 'help' });
  };

  // Route entries (the privacy pages, one of them interactive) are full pages, so
  // they navigate rather than opening the read-only doc modal. Close the launcher
  // and let the Link perform the navigation.
  const handleNavigate = (action: string) => {
    setIsOpen(false);
    trackEvent({ action, category: 'help' });
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
                    Our guides and privacy documents live on algebranch.org, rendered from the version-controlled source. Guides open here; the privacy pages open in full:
                  </span>
                </div>
              </div>

              {/* Resource cards, grouped exactly as /docs and the page footers are
                  (Guides / Privacy & Trust) from the one NAV_SECTIONS registry.
                  Guides open in the in-app DocModal (#514), syncing the URL to the
                  crawlable `/<slug>`; the privacy pages navigate to their route. */}
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="flex flex-col gap-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${THEME_GLASS.TEXT_MUTED} select-none`}
                  >
                    {section.label}
                  </span>
                  <div className="flex flex-col gap-3">
                    {section.entries.map((entry) =>
                      entry.open === 'modal' && entry.slug ? (
                        <button
                          key={entry.href}
                          type="button"
                          onClick={() => handleOpenDoc(entry.slug as string, actionFor(entry))}
                          className={CARD_CLASS}
                        >
                          <CardInner entry={entry} />
                        </button>
                      ) : (
                        <Link
                          key={entry.href}
                          href={entry.href}
                          onClick={() => handleNavigate(actionFor(entry))}
                          className={CARD_CLASS}
                        >
                          <CardInner entry={entry} />
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              ))}

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
            <div className={`flex justify-between items-center gap-3 mt-5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 select-none shrink-0`}>
              <div className="flex items-center gap-4 min-w-0">
                <Link
                  href="/docs"
                  onClick={() => handleNavigate('help_open_docs_index')}
                  className={`${THEME_GLASS.LINK} flex items-center gap-1.5`}
                >
                  <BookText size={14} className="shrink-0" />
                  All documentation
                </Link>
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
                className={`px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY} shrink-0`}
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
