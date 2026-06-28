// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileUp, AlertTriangle } from 'lucide-react';
import {
  importWorkspacesModalOpenAtom,
  importWorkspacesAtom,
  savedSessionsAtom,
} from '../store/equation';
import {
  parseWorkspacesJson,
  hashWorkspace,
  ExportedWorkspace,
} from '../utils/workspaceTransfer';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { trackEvent } from '../utils/analytics';
import { WorkspaceSelectList } from './WorkspaceSelectList';

export const ImportWorkspacesModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(importWorkspacesModalOpenAtom);
  const savedSessions = useAtomValue(savedSessionsAtom);
  const importWorkspaces = useSetAtom(importWorkspacesAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ExportedWorkspace[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Content hashes already in the library, so we can flag duplicates inline.
  const existingHashes = useMemo(
    () => new Set(savedSessions.map(s => hashWorkspace(s))),
    [savedSessions],
  );

  const reset = () => {
    setParsed(null);
    setSelected(new Set());
    setError(null);
    setFileName('');
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const text = await file.text();
      const { workspaces } = parseWorkspacesJson(text);
      if (workspaces.length === 0) {
        setError('This file contains no workspaces.');
        return;
      }
      setParsed(workspaces);
      // Pre-check everything except workspaces already present in the library.
      setSelected(
        new Set(workspaces.filter(w => !existingHashes.has(hashWorkspace(w))).map(w => w.id)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so re-picking the same file re-fires onChange.
    e.target.value = '';
  };

  const handleImport = () => {
    if (!parsed) return;
    const chosen = parsed.filter(w => selected.has(w.id));
    if (chosen.length === 0) return;
    const { added, skipped } = importWorkspaces(chosen);
    trackEvent({ action: 'import_workspaces', category: 'workspaces', value: added });
    handleClose();
    // Brief outcome cue via the badge-free path: nothing else to do — the
    // library re-renders with the new entries. `skipped`/`added` reported below
    // would require a toast system; kept minimal per #203 scope.
    void skipped;
  };

  const decorated = useMemo(
    () =>
      (parsed ?? []).map(w => {
        const duplicate = existingHashes.has(hashWorkspace(w));
        return {
          ...w,
          disabled: duplicate,
          disabledReason: duplicate ? 'Already in your library' : undefined,
        };
      }),
    [parsed, existingHashes],
  );

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
            aria-labelledby="import-workspaces-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <Download className="text-indigo-400 w-5 h-5" />
                <h2 id="import-workspaces-title" className="text-lg font-bold text-white tracking-wide">Import Workspaces</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onFileChange}
              className="hidden"
            />

            {!parsed && (
              <div className="flex flex-col gap-4 shrink-0">
                <p className={`text-sm ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                  Choose an Algebranch workspace file (<span className="font-mono text-xs">.json</span>) to merge into your saved workspaces. Existing workspaces are never overwritten.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 px-4 py-6 rounded-xl border border-dashed border-white/15 hover:border-indigo-400/40 hover:bg-white/[0.02] text-sm font-semibold text-white/80 hover:text-white transition-all cursor-pointer`}
                >
                  <FileUp size={16} />
                  <span>Choose file&hellip;</span>
                </button>
                {error && (
                  <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {parsed && (
              <>
                <p className={`text-sm ${THEME_GLASS.TEXT_MUTED_LIGHT} mb-4 shrink-0 truncate`}>
                  From <span className="font-semibold text-white">{fileName}</span> — select which to import.
                </p>
                <div className="flex-1 min-h-0 flex flex-col mb-5">
                  <WorkspaceSelectList
                    workspaces={decorated}
                    selected={selected}
                    onSelectionChange={setSelected}
                    emptyMessage="This file contains no workspaces."
                  />
                </div>
              </>
            )}

            <div className={`flex items-center justify-end gap-3 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 shrink-0`}>
              <button
                type="button"
                onClick={handleClose}
                className={`px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY}`}
              >
                Cancel
              </button>
              {parsed && (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={selected.size === 0}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold ${THEME_GLASS.BUTTON_PRIMARY} disabled:opacity-40 disabled:pointer-events-none`}
                >
                  <Download size={13} />
                  <span>Import{selected.size > 0 ? ` (${selected.size})` : ''}</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
