// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  resetHistoryModalOpenAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  sourcePathAtom,
  hoverPathAtom,
} from '../store/equation';
import { trackEvent } from '../utils/analytics';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';

export const ResetHistoryModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(resetHistoryModalOpenAtom);
  const [tree, setTree] = useAtom(historyTreeAtom);
  const setCurrentNodeId = useSetAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);

  const stepCount = Math.max(0, Object.keys(tree).length - 1);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore.
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const handleReset = () => {
    if (Object.keys(tree).length > 1) {
      const rootNode = tree["0"];
      setTree({
        "0": {
          id: "0",
          equation: rootNode.equation,
          parentId: null,
          childrenIds: [],
          label: "Initial",
          timestamp: rootNode.timestamp,
        }
      });
      setCurrentNodeId("0");
      trackEvent({
        action: 'reset_history',
        category: 'history',
      });
      setSourcePath(null);
      setHoverPath(null);
    }
    setIsOpen(false);
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
            aria-labelledby="reset-history-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(239,68,68,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="text-red-400 w-5 h-5" />
                <h2 id="reset-history-title" className="text-lg font-bold text-white tracking-wide">Reset History</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-1 mb-6 text-sm text-zinc-300">
              <p>
                Are you sure you want to reset the history tree?
              </p>
              <p className="mt-2 text-zinc-400">
                This will discard <strong className="text-white/80">{stepCount} derivation {stepCount === 1 ? 'step' : 'steps'}</strong> and return to the initial equation. This action cannot be undone.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 h-9 rounded-xl border border-white/10 hover:border-white/20 text-xs font-semibold text-white/80 hover:text-white bg-white/0 hover:bg-white/5 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 px-4 py-2 h-9 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/25 active:scale-95 transition-all cursor-pointer text-center"
              >
                <RotateCcw size={13} />
                <span>Reset History</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
