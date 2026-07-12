// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { activeHelpDocAtom } from '../store/equation';
import { DOC_BY_SLUG, HELP_DOC_SLUGS } from '../constants/docsPages';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DocModalProps {
  /**
   * Pre-rendered body for each help doc, keyed by slug. Built server-side by
   * DocModalHost from the same DocMarkdown the /<slug> route renders, so the
   * modal and the crawlable page can't drift. Nodes stay unmounted until their
   * doc is active, so a crawler on a doc route sees no duplicate.
   */
  docs: Record<string, React.ReactNode>;
}

const slugFromPath = (path: string): string => path.replace(/^\//, '').replace(/\/$/, '');

/**
 * The in-app documentation modal (#514). The Help launcher's cards open a guide
 * here — the same "in-app modal feel" as the `K` shortcuts overlay — while the
 * URL is synced to the crawlable `/<slug>` via the History API, so the address is
 * still shareable and the Back button closes the modal. A cold load of that URL
 * renders the full standalone page instead (see app/<slug>/page.tsx), keeping one
 * canonical, crawlable address per doc. We drive history ourselves rather than
 * via Next intercepting routes, which don't fill their slot reliably in this app.
 */
export const DocModal: React.FC<DocModalProps> = ({ docs }) => {
  const [activeDoc, setActiveDoc] = useAtom(activeHelpDocAtom);
  const isOpen = activeDoc !== null;
  const meta = activeDoc ? DOC_BY_SLUG[activeDoc] : undefined;

  // True while we own a pushed history entry for the open modal, so we know to
  // walk it back on close (Back-button semantics) rather than leaving it behind.
  const ownsHistoryEntry = React.useRef(false);

  // Opening: push a `/<slug>` history entry so the address bar shows the doc and
  // Back closes it. Guarded so a popstate-driven open (below) doesn't re-push.
  React.useEffect(() => {
    if (activeDoc && !ownsHistoryEntry.current) {
      ownsHistoryEntry.current = true;
      window.history.pushState({ helpDoc: activeDoc }, '', `/${activeDoc}`);
    }
  }, [activeDoc]);

  // Back/Forward: reconcile the atom to whatever the URL now is — a doc slug
  // reopens the modal (forward), anything else closes it (back to the app).
  React.useEffect(() => {
    const onPopState = () => {
      const slug = slugFromPath(window.location.pathname);
      if (HELP_DOC_SLUGS.includes(slug)) {
        ownsHistoryEntry.current = true;
        setActiveDoc(slug);
      } else {
        ownsHistoryEntry.current = false;
        setActiveDoc(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setActiveDoc]);

  // Closing walks history back when we pushed an entry, so the URL returns to
  // where the user was and Forward can reopen; the popstate handler clears the
  // atom. If we somehow hold no entry, clear it directly.
  const handleClose = React.useCallback(() => {
    if (ownsHistoryEntry.current) {
      window.history.back();
    } else {
      setActiveDoc(null);
    }
  }, [setActiveDoc]);

  // Focus trap + scroll lock + Escape-to-close + focus restore.
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  return (
    <AnimatePresence>
      {isOpen && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container — wider than the launcher; docs are long-form. */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-2xl overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div
              className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="text-indigo-400 w-5 h-5" />
                <h2 id="doc-modal-title" className="text-lg font-bold text-white tracking-wide">
                  {meta.title}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content — focusable so keyboard users can scroll a long doc
                (axe: scrollable-region-focusable). */}
            <div
              tabIndex={0}
              className={`flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}
            >
              {docs[meta.slug]}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
