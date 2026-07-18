// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Share2, WifiOff, Hourglass, Loader2, ShieldCheck, AlertTriangle, Copy, ChevronDown } from 'lucide-react';
import {
  shareModalOpenAtom,
  settingsAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  currentTabNameAtom,
  toastAtom,
  type ShareScope,
  exportPreviewActiveAtom,
  filterTreeToPath,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { safeCopyText } from '../utils/clipboard';
import { serializeWorkspaceState } from '../store/equation';
import { equationToString, type Equation } from 'math-engine';
import { WorkspaceTreeView } from './WorkspaceTreeView';
import { PreviewEquationNode } from './PreviewEquationNode';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { Tooltip } from './Tooltip';
import { CAPABILITY_GATES } from '../constants/capabilityGates';
import {
  createShareLink,
  busyShareSummary,
  nextUtcMidnight,
  classifyLinkSize,
  bandAdvice,
  LINK_NOT_COPIED_TOAST,
  type ShortLinkFailure,
} from '../utils/shareLink';
import { safeStorage } from '../utils/safeStorage';
import Link from 'next/link';

const EquationPreviewRow: React.FC<{ eq: Equation }> = ({ eq }) => (
  <div className="flex items-center justify-center gap-1.5 flex-nowrap text-lg text-white w-max mx-auto">
    <PreviewEquationNode path="lhs" customEquation={eq} />
    <span className="font-mono px-1 select-none text-indigo-300">{RELATION_DISPLAY[eq.relation ?? '='] ?? '='}</span>
    <PreviewEquationNode path="rhs" customEquation={eq} />
  </div>
);

export const ShareModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(shareModalOpenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const tree = useAtomValue(historyTreeAtom);
  const currentNodeId = useAtomValue(currentNodeIdAtom);
  const currentTabName = useAtomValue(currentTabNameAtom);
  const setToast = useSetAtom(toastAtom);
  const online = useOnlineStatus();
  const setExportPreviewActive = useSetAtom(exportPreviewActiveAtom);

  const activeEquation = currentNodeId ? tree[currentNodeId]?.equation ?? null : null;
  const hasWorkspace = !!(currentNodeId && tree[currentNodeId]);

  // Modal configuration states
  const [scope, setScope] = React.useState<ShareScope>('full');

  // Handle path dimming preview dynamically
  React.useEffect(() => {
    if (isOpen && scope === 'path') {
      setExportPreviewActive(true);
    } else {
      setExportPreviewActive(false);
    }
  }, [isOpen, scope, setExportPreviewActive]);

  React.useEffect(() => {
    return () => {
      setExportPreviewActive(false);
    };
  }, [setExportPreviewActive]);
  const [delivery, setDelivery] = React.useState<'short' | 'offline'>('short');
  const [creating, setCreating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [shortLinkFailure, setShortLinkFailure] = React.useState<ShortLinkFailure | null>(null);
  
  // Real-time link values
  const [rawUrl, setRawUrl] = React.useState('');
  const [isClassroomExpanded, setIsClassroomExpanded] = React.useState(() => {
    try {
      const saved = safeStorage.getItem('algebranch_classroom_expanded');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleClassroom = () => {
    setIsClassroomExpanded((prev) => {
      const next = !prev;
      try {
        safeStorage.setItem('algebranch_classroom_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Compute active path equations for conflict checks
  const equationsToInspect = React.useMemo(() => {
    if (!tree || !currentNodeId) return [];
    if (scope === 'equation') {
      const node = tree[currentNodeId];
      return node ? [equationToString(node.equation)] : [];
    } else if (scope === 'path') {
      const eqs: string[] = [];
      let currId: string | null = currentNodeId;
      while (currId && tree[currId]) {
        eqs.push(equationToString(tree[currId].equation));
        currId = tree[currId].parentId;
      }
      return eqs;
    } else {
      return Object.values(tree).map((node) => equationToString(node.equation));
    }
  }, [tree, currentNodeId, scope]);

  const previewTree = React.useMemo(() => {
    if (!tree || !currentNodeId) return null;
    if (scope === 'path') {
      return filterTreeToPath(tree, currentNodeId);
    }
    return tree;
  }, [tree, currentNodeId, scope]);

  const nodesToInspect = React.useMemo(() => {
    if (!tree || !currentNodeId) return [];
    if (scope === 'equation') {
      return [];
    } else if (scope === 'path') {
      const nodes: (typeof tree)[string][] = [];
      let currId: string | null = currentNodeId;
      while (currId && tree[currId]) {
        nodes.push(tree[currId]);
        currId = tree[currId].parentId;
      }
      return nodes;
    } else {
      return Object.values(tree);
    }
  }, [tree, currentNodeId, scope]);

  // Compute locked status messages for each gate
  const gateLockMessages = React.useMemo(() => {
    const locks: Record<string, string | null> = {};
    for (const gate of CAPABILITY_GATES) {
      locks[gate.key] = gate.checkLock(equationsToInspect, nodesToInspect);
    }
    return locks;
  }, [equationsToInspect, nodesToInspect]);

  // Auto-correct capability gates if workspace already violates them (forces them ON)
  React.useEffect(() => {
    if (!isOpen) return;
    let modified = false;
    const nextSettings = { ...settings };
    for (const gate of CAPABILITY_GATES) {
      if (gateLockMessages[gate.key] && !settings[gate.key]) {
        nextSettings[gate.key] = true;
        modified = true;
      }
    }
    if (modified) {
      setSettings(nextSettings);
    }
  }, [isOpen, gateLockMessages, settings, setSettings]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  // Generate the preview/offline URL dynamically based on options
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const updateUrl = async () => {
      try {
        const compressed = await serializeWorkspaceState(tree, currentNodeId, currentTabName, scope, settings);
        if (!active) return;
        const origin = window.location.origin;
        if (delivery === 'offline') {
          setRawUrl(`${origin}?ws=${compressed}`);
        } else {
          // Temporarily set placeholder until they click Copy or load short link
          setRawUrl(`${origin}/s#key`);
        }
      } catch (err) {
        console.error('Failed to compute workspace URL:', err);
      }
    };
    updateUrl();
    return () => { active = false; };
  }, [isOpen, tree, currentNodeId, currentTabName, scope, delivery, settings]);

  const handleCopyLink = async () => {
    setShortLinkFailure(null);
    if (delivery === 'offline') {
      const success = await safeCopyText(rawUrl);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        trackEvent({ action: 'share_offline_link', category: 'interaction', label: scope });
      } else {
        setToast({ message: LINK_NOT_COPIED_TOAST, key: Date.now(), type: 'error' });
      }
      return;
    }

    // Short link creation
    setCreating(true);
    try {
      const compressed = await serializeWorkspaceState(tree, currentNodeId, currentTabName, scope, settings);
      const origin = window.location.origin;
      const result = await createShareLink(compressed, origin);
      if (result.status === 'ok') {
        setRawUrl(result.url);
        const success = await safeCopyText(result.url);
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          trackEvent({ action: 'share_short_link', category: 'interaction', label: scope });
        } else {
          setToast({ message: LINK_NOT_COPIED_TOAST, key: Date.now(), type: 'error' });
        }
      } else {
        setShortLinkFailure(
          result.status === 'busy'
            ? { kind: 'busy', dailyLimit: result.dailyLimit, resetsAt: nextUtcMidnight(new Date()) }
            : { kind: 'error' },
        );
        setToast({ message: 'Short link not copied', key: Date.now(), type: 'error' });
      }
    } catch (err) {
      console.error('Failed to create short link:', err);
      setShortLinkFailure({ kind: 'error' });
      setToast({ message: 'Short link not copied', key: Date.now(), type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const isBusy = shortLinkFailure?.kind === 'busy';
  const showShortLinkDisabled = !online || isBusy;

  // Auto-switch to offline delivery if online status goes down or budget is busy
  React.useEffect(() => {
    if (showShortLinkDisabled && delivery === 'short') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelivery('offline');
    }
  }, [showShortLinkDisabled, delivery]);

  if (!isOpen) return null;

  const urlSize = rawUrl.length;
  const sizeBand = classifyLinkSize(urlSize);
  const sizeAdvice = delivery === 'offline' ? bandAdvice(urlSize, { hasSmallerScope: scope !== 'equation' }) : null;

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
            aria-labelledby="share-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-5 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <Share2 className="text-indigo-400 w-5 h-5" />
                <h2 id="share-modal-title" className="text-lg font-bold text-white tracking-wide">Share</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content container */}
            <div className="flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto pr-1">
              
              {/* Option 1: Scope */}
              <div className={THEME_GLASS.SETTING_ROW_STACKED}>
                <span className="text-sm font-semibold text-white">Share scope</span>
                <div role="radiogroup" aria-label="Share scope" className={`${THEME_GLASS.SEGMENT_GROUP} w-full`}>
                  {(['full', 'path', 'equation'] as ShareScope[]).map((opt) => {
                    const isActive = scope === opt;
                    const label = opt === 'full' ? 'Whole workspace' : opt === 'path' ? 'Derivation only' : 'Equation only';
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => { setScope(opt); setCopied(false); }}
                        className={`${THEME_GLASS.SEGMENT_BTN} flex-1 ${
                          isActive ? THEME_GLASS.SEGMENT_BTN_ACTIVE : THEME_GLASS.SEGMENT_BTN_IDLE
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Live Preview Area */}
                <div className="flex flex-col gap-1.5 mt-3">
                  <span className="text-xs font-semibold text-white/50 select-none">Preview</span>
                  {scope === 'equation' ? (
                    activeEquation ? (
                      <div className="h-32 overflow-auto p-4 flex items-center justify-center rounded-xl border border-white/5 bg-white/[0.01]">
                        <EquationPreviewRow eq={activeEquation} />
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-center px-4 rounded-xl border border-white/5 bg-white/[0.01]">
                        <span className="text-xs text-white/40">No equation to preview.</span>
                      </div>
                    )
                  ) : (
                    hasWorkspace ? (
                      <div className="h-32 overflow-hidden relative rounded-xl border border-white/5 bg-white/[0.01]">
                        <div className="absolute inset-0 w-full h-full">
                          <WorkspaceTreeView
                            interactive={false}
                            className="h-full w-full overflow-hidden"
                            tree={previewTree ?? undefined}
                            zoomMode="full-tree"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-center px-4 rounded-xl border border-white/5 bg-white/[0.01]">
                        <span className="text-xs text-white/40">No workspace to preview.</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Classroom Settings (Collapsible, collapsed by default) */}
              <div className="border border-white/5 bg-white/[0.01] rounded-xl overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={handleToggleClassroom}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] text-left transition-colors cursor-pointer select-none"
                >
                  <span className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">Classroom Settings</span>
                  <ChevronDown size={14} className={`text-indigo-400 transition-transform duration-200 ${isClassroomExpanded ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                {isClassroomExpanded && (
                  <div className="px-4 pb-4 flex flex-col gap-4 border-t border-white/5 pt-3 animate-[fadeIn_0.2s_ease-out]">
                    {CAPABILITY_GATES.map((gate) => {
                      const lockReason = gateLockMessages[gate.key];
                      const isLocked = !!lockReason;
                      const isChecked = settings[gate.key];

                      return (
                        <div key={gate.key} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-white">{gate.label}</span>
                              {isLocked && (
                                <Tooltip
                                  content={lockReason}
                                  position="top"
                                  className="text-xs text-center"
                                >
                                  <AlertTriangle size={12} className="text-amber-400 cursor-help shrink-0" />
                                </Tooltip>
                              )}
                            </div>
                            <span className="text-[10px] text-white/50 leading-snug">
                              {gate.description}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const nextVal = !isChecked;
                              setSettings((prev) => ({
                                ...prev,
                                [gate.key]: nextVal,
                              }));
                              trackEvent({
                                action: `toggle_${gate.key}`,
                                category: 'share_modal',
                                label: nextVal ? 'on' : 'off',
                              });
                            }}
                            className={`${THEME_GLASS.TOGGLE_TRACK} ${
                              isChecked
                                ? THEME_GLASS.TOGGLE_TRACK_ON
                                : THEME_GLASS.TOGGLE_TRACK_OFF
                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={isChecked}
                            aria-label={`Toggle ${gate.label.toLowerCase()} option`}
                          >
                            <span
                              className={`${THEME_GLASS.TOGGLE_KNOB} ${
                                isChecked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Option 2: Delivery */}
              <div className={THEME_GLASS.SETTING_ROW_STACKED}>
                <span className="text-sm font-semibold text-white">Delivery method</span>
                <div role="radiogroup" aria-label="Delivery method" className={`${THEME_GLASS.SEGMENT_GROUP} w-full`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={delivery === 'short'}
                    disabled={showShortLinkDisabled}
                    onClick={() => { setDelivery('short'); setCopied(false); }}
                    className={`${THEME_GLASS.SEGMENT_BTN} flex-1 ${
                      delivery === 'short' ? THEME_GLASS.SEGMENT_BTN_ACTIVE : THEME_GLASS.SEGMENT_BTN_IDLE
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Short Link
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={delivery === 'offline'}
                    onClick={() => { setDelivery('offline'); setCopied(false); }}
                    className={`${THEME_GLASS.SEGMENT_BTN} flex-1 ${
                      delivery === 'offline' ? THEME_GLASS.SEGMENT_BTN_ACTIVE : THEME_GLASS.SEGMENT_BTN_IDLE
                    }`}
                  >
                    Works Offline
                  </button>
                </div>
                {!online && (
                  <span className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <WifiOff size={10} />
                    You are offline — short links require a connection.
                  </span>
                )}
                {isBusy && (
                  <span className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <Hourglass size={10} />
                    {busyShareSummary(shortLinkFailure?.dailyLimit, new Date())}
                  </span>
                )}
              </div>

              {/* Link Preview */}
              <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-xs font-semibold text-white/50 select-none">Link preview</span>
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.01] font-mono text-[10px] text-white/60 select-all max-h-[4.5em] overflow-y-auto break-all leading-normal">
                  {rawUrl || 'Generating share link...'}
                </div>
              </div>

              {/* Action / Copy Button */}
              <div className="flex flex-col gap-3 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={creating}
                  className={`${THEME_GLASS.BUTTON_PRIMARY} w-full py-3 text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2`}
                >
                  {creating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating Link…</span>
                    </>
                  ) : copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Share Link</span>
                    </>
                  )}
                </button>

                {/* Size stats & advice */}
                {delivery === 'offline' && (
                  <div className="flex flex-col gap-1 px-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40">Offline Payload Size</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className={sizeBand.tone === 'warn' ? 'text-amber-300' : 'text-emerald-400'}>
                          {sizeBand.label} link
                        </span>
                        <span className="text-white/30">|</span>
                        <span className="text-white/50">{urlSize.toLocaleString()} chars</span>
                      </div>
                    </div>
                    {sizeAdvice && (
                      <span className="text-[9px] text-amber-300/80 leading-normal mt-0.5">
                        ⚠️ {sizeAdvice}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <span aria-hidden="true" className={THEME_GLASS.SHARE_MENU_DIVIDER} />
              <div className="flex items-start gap-2 px-1 pb-1">
                <ShieldCheck size={14} className="shrink-0 mt-0.5 text-indigo-400/80" />
                <span className="text-[10px] text-white/50 leading-normal">
                  Your work is fully private — details never leave your browser unencrypted. See{' '}
                  <Link href="/privacy" onClick={handleClose} className="text-indigo-400 hover:underline transition-colors">
                    how sharing works
                  </Link>.
                </span>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
