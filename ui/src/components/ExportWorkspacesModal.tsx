// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload } from 'lucide-react';
import {
  exportWorkspacesModalOpenAtom,
  savedSessionsAtom,
} from '../store/equation';
import { serializeWorkspacesToJson } from '../utils/workspaceTransfer';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { trackEvent } from '../utils/analytics';
import { WorkspaceSelectList } from './WorkspaceSelectList';

const fileDateStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const ExportWorkspacesModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(exportWorkspacesModalOpenAtom);
  const savedSessions = useAtomValue(savedSessionsAtom);

  // Tutorial/onboarding sessions are app-managed and not exportable (#203).
  const exportable = useMemo(
    () => savedSessions.filter(s => !s.chapterId),
    [savedSessions],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default to all checked each time the modal (re-)opens. Using the
  // render-time "previous value" pattern rather than an effect avoids the
  // cascading-render lint and applies the default before first paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSelected(new Set(exportable.map(s => s.id)));
  }

  const handleClose = () => setIsOpen(false);
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const handleExport = () => {
    const chosen = exportable.filter(s => selected.has(s.id));
    if (chosen.length === 0) return;
    const json = serializeWorkspacesToJson(chosen);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `algebranch-workspaces-${fileDateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent({ action: 'export_workspaces', category: 'workspaces', value: chosen.length });
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-workspaces-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <Upload className="text-indigo-400 w-5 h-5" />
                <h2 id="export-workspaces-title" className="text-lg font-bold text-white tracking-wide">Export Workspaces</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED_LIGHT} mb-4 shrink-0`}>
              Download the selected workspaces as a JSON file you can back up, move to another device, or share.
            </p>

            <div className="flex-1 min-h-0 flex flex-col mb-5">
              <WorkspaceSelectList
                workspaces={exportable}
                selected={selected}
                onSelectionChange={setSelected}
                emptyMessage="You have no workspaces to export yet."
              />
            </div>

            <div className={`flex items-center justify-end gap-3 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 shrink-0`}>
              <button
                type="button"
                onClick={handleClose}
                className={`px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={selected.size === 0}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold ${THEME_GLASS.BUTTON_PRIMARY} disabled:opacity-40 disabled:pointer-events-none`}
              >
                <Upload size={13} />
                <span>Export{selected.size > 0 ? ` (${selected.size})` : ''}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
