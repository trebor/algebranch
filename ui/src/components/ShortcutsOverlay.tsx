// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { shortcutsOverlayOpenAtom } from '../store/equation';
import { ShortcutConfig } from '../hooks/useKeyboardShortcuts';
import { formatShortcut } from '../utils/keyboardShortcuts';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';

const UNCATEGORIZED = 'Other';

interface ShortcutsOverlayProps {
  /** The single source-of-truth bindings, shared with the live handler. */
  shortcuts: ShortcutConfig[];
}

/** Detects macOS so we can render ⌘/⌥ symbols instead of Ctrl/Alt words. */
const detectIsMac = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const probe = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/i.test(probe);
};

interface CategoryGroup {
  category: string;
  items: ShortcutConfig[];
}

/**
 * Groups the (non-hidden) bindings by category, preserving first-seen order so
 * the overlay reads in the same order the bindings are declared.
 */
const groupByCategory = (shortcuts: ShortcutConfig[]): CategoryGroup[] => {
  const groups: CategoryGroup[] = [];
  shortcuts.forEach((shortcut) => {
    if (shortcut.hidden) return;
    const category = shortcut.category ?? UNCATEGORIZED;
    const existing = groups.find((g) => g.category === category);
    if (existing) {
      existing.items.push(shortcut);
    } else {
      groups.push({ category, items: [shortcut] });
    }
  });
  return groups;
};

/**
 * The `?` keyboard-shortcuts cheat-sheet (#126). Renders every visible binding
 * from the same array the live handler uses, so the two can't drift. Closes on
 * Escape or backdrop click — its own toggle key is suppressed while open (the
 * overlay counts toward `anyModalOpenAtom`).
 */
export const ShortcutsOverlay: React.FC<ShortcutsOverlayProps> = ({ shortcuts }) => {
  const [isOpen, setIsOpen] = useAtom(shortcutsOverlayOpenAtom);
  const isMac = React.useMemo(() => detectIsMac(), []);
  const groups = React.useMemo(() => groupByCategory(shortcuts), [shortcuts]);

  const handleClose = React.useCallback(() => setIsOpen(false), [setIsOpen]);

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
            aria-labelledby="shortcuts-overlay-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-lg overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL}`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
              <div className="flex items-center gap-2.5">
                <Keyboard className="text-indigo-400 w-5 h-5" />
                <h2 id="shortcuts-overlay-title" className="text-lg font-bold text-white tracking-wide">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content — focusable so keyboard users can scroll the list when it
                overflows (axe: scrollable-region-focusable). */}
            <div tabIndex={0} className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.category}>
                  <h3 className="text-xs font-bold capitalize tracking-widest text-indigo-300/70 mb-2 select-none">
                    {group.category}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((shortcut) => (
                      <div
                        key={`${shortcut.key}-${shortcut.description}`}
                        className="flex items-center justify-between gap-4 py-1"
                      >
                        <span className="text-sm text-zinc-300">{shortcut.description}</span>
                        {shortcut.leader ? (
                          // Two-step sequence: render "leader then key" as two chips.
                          <span className="flex items-center gap-1.5 shrink-0">
                            <kbd className={THEME_GLASS.SHORTCUT_KEYCAP}>
                              {formatShortcut({ key: shortcut.leader }, isMac)}
                            </kbd>
                            <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>then</span>
                            <kbd className={THEME_GLASS.SHORTCUT_KEYCAP}>
                              {formatShortcut({ key: shortcut.key }, isMac)}
                            </kbd>
                          </span>
                        ) : (
                          <kbd className={THEME_GLASS.SHORTCUT_KEYCAP}>
                            {shortcut.keyLabel ?? formatShortcut(shortcut, isMac)}
                          </kbd>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className={`border-t border-white/5 pt-4 mt-4 text-xs ${THEME_GLASS.TEXT_MUTED} select-none`}>
              Press <kbd className={`${THEME_GLASS.SHORTCUT_KEYCAP} !h-5 !min-w-[1.25rem] !px-1.5`}>k</kbd> any time to reopen this list.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
