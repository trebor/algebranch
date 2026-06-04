'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import {
  deleteConfirmationModalOpenAtom,
  deleteSessionAtom,
  currentSessionIdAtom,
  tabsAtom,
  activeTabIdAtom
} from '../store/equation';
import { trackEvent } from '../utils/analytics';
import { THEME_GLASS } from '../constants/theme';

export const DeleteWorkspaceModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(deleteConfirmationModalOpenAtom);
  const deleteSession = useSetAtom(deleteSessionAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);

  // Find current tab name for custom feedback inside the modal
  const activeTab = tabs.find(t => t.id === activeTabId);
  const tabName = activeTab ? activeTab.name : 'this workspace';

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

  const handleDelete = () => {
    if (!currentSessionId) return;
    
    deleteSession(currentSessionId);
    trackEvent({
      action: 'delete_session',
      category: 'sessions',
      label: currentSessionId,
    });
    
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
                <h2 className="text-lg font-bold text-white tracking-wide">Delete Workspace</h2>
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
                Are you sure you want to permanently delete <strong>{tabName}</strong>?
              </p>
              <p className="mt-2 text-zinc-400">
                This action is irreversible and will delete all derivation steps associated with this workspace tab.
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
                onClick={handleDelete}
                className="flex items-center justify-center gap-1.5 px-4 py-2 h-9 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/25 active:scale-95 transition-all cursor-pointer text-center"
              >
                <Trash2 size={13} />
                <span>Delete Workspace</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
