// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { CopyFormatMenu } from './CopyFormatMenu';
import { WorkspaceTreeView } from './WorkspaceTreeView';
import { equationToString } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  sourcePathAtom,
  hoverPathAtom,
  rightSidebarOpenAtom,
  resetHistoryModalOpenAtom,
  exportPreviewActiveAtom,
  formatDerivation,
  getDerivationScope,
  getDerivationSteps,
  getActivePathIds,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, GitFork } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useIsShortScreen } from '../hooks/useIsShortScreen';
import { useIsHydrated } from '../hooks/useIsHydrated';

interface ControlPanelProps {
  onCloseMobile?: () => void;
  noBorder?: boolean;
  /**
   * When set, marks this instance as the skip-link target for the history region
   * (#257). Only the always-present desktop instance passes it; the mobile
   * bottom-sheet instance omits it so the id stays unique in the document.
   */
  regionId?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onCloseMobile, noBorder, regionId }) => {
  const isMobile = useIsMobile();
  // On short (mobile-landscape) viewports the header's generous spacing steals
  // scarce vertical room from the tree (#325); tighten it there.
  const isShort = useIsShortScreen();
  const headingId = React.useId();
  const [tree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);
  const setExportPreview = useSetAtom(exportPreviewActiveAtom);
  const isHydrated = useIsHydrated();

  const derivationSteps = React.useMemo(
    () => getDerivationSteps(tree, currentNodeId),
    [tree, currentNodeId],
  );

  const exportScope = getDerivationScope(tree, currentNodeId);



  // Undo moves to the parent step
  const activeNode = tree[currentNodeId];
  const canUndo = activeNode && activeNode.parentId !== null;
  
  // Redo moves to the last spawned child of the active step
  const canRedo = activeNode && activeNode.childrenIds.length > 0;

  const handleUndo = () => {
    if (canUndo && activeNode.parentId) {
      setCurrentNodeId(activeNode.parentId);
      trackEvent({
        action: 'undo_step',
        category: 'history',
        label: activeNode.parentId,
      });
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
      setCurrentNodeId(nextId);
      trackEvent({
        action: 'redo_step',
        category: 'history',
        label: nextId,
      });
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleResetAll = () => {
    if (Object.keys(tree).length > 1) {
      setResetHistoryModalOpen(true);
    }
  };

  return (
    // <aside> (complementary) landmark labelled by the History heading, so the
    // right sidebar surfaces in a screen-reader rotor symmetric with the left
    // "Equation library" aside (#237). Was a generic role="region" (#257).
    <aside
      id={regionId}
      aria-labelledby={headingId}
      // tabIndex=-1 only on the skip-link target instance, so the "Skip to
      // history" link can land focus here without adding a Tab stop (#257).
      tabIndex={regionId ? -1 : undefined}
      className={`w-full h-full flex flex-col outline-none ${isShort ? 'gap-2' : 'gap-4'} ${
        isMobile || noBorder
          ? 'p-0 bg-transparent'
          : `${THEME_GLASS.PANEL} p-4`
      }`}
    >
      {/* Sidebar Header with Timeline Actions */}
      <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER} ${isShort ? 'pb-2' : 'pb-4'} shrink-0`}>
        <Tooltip content={<HotkeyHint label="Toggle Sidebar" keys="H" />} position="left" autoAlign={false}>
          <h2
            id={headingId}
            onClick={() => setRightSidebarOpen(false)}
            className="text-base lg:text-lg font-semibold lg:font-bold text-white flex items-center gap-2 select-none cursor-pointer hover:text-indigo-200 transition-colors"
          >
            <GitFork className="text-indigo-400 rotate-180" size={18} />
            <span>History</span>
          </h2>
        </Tooltip>
        <div className="flex items-center gap-1.5">
          <CopyFormatMenu
            getText={(format) => formatDerivation(tree, currentNodeId, format)}
            iconSize={16}
            variant="panel"
            tooltip={<HotkeyHint label="Copy full derivation" />}
            // Gate on the ACTIVE PATH length (root → current), not the total node
            // count: the control copies/exports that path, so at the root — a
            // single-step path — there is nothing to export even when the tree has
            // branches or later steps (#130). Mirrors the scope label just below.
            disabled={isHydrated ? exportScope.stepCount <= 1 : undefined}
            trackAction="copy_derivation"
            trackCategory="history"
            trackLabel={currentNodeId}
            scopeLabel={`Full derivation · ${exportScope.stepCount} ${exportScope.stepCount === 1 ? 'step' : 'steps'}`}
            scopeEquation={exportScope.endpoint}
            exportScope="derivation"
            exportEquation={exportScope.endpoint}
            exportSteps={derivationSteps}
            onPreviewChange={setExportPreview}
          />
          <Tooltip content={<HotkeyHint label="Undo step" keys="⌘Z" />}>
            <button
              onClick={handleUndo}
              disabled={isHydrated ? !canUndo : undefined}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
              aria-label="Undo step"
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
          <Tooltip content={<HotkeyHint label="Redo step" keys="⌘⇧Z" />}>
            <button
              onClick={handleRedo}
              disabled={isHydrated ? !canRedo : undefined}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
              aria-label="Redo step"
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>

          <Tooltip content="Reset history">
            <button
              onClick={handleResetAll}
              disabled={isHydrated ? Object.keys(tree).length <= 1 : undefined}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
              aria-label="Reset history"
            >
              <RotateCcw size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Step History Tree Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <WorkspaceTreeView onAfterSelect={onCloseMobile} />
      </div>
    </aside>
  );
};

interface TimelineContentProps {
  onCloseMobile?: () => void;
}

export const TimelineContent: React.FC<TimelineContentProps> = ({ onCloseMobile }) => {
  const [tree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);
  const isHydrated = useIsHydrated();

  const activeNode = tree[currentNodeId];
  const canUndo = activeNode && activeNode.parentId !== null;
  const canRedo = activeNode && activeNode.childrenIds.length > 0;

  const handleUndo = () => {
    if (canUndo && activeNode.parentId) {
      setCurrentNodeId(activeNode.parentId);
      trackEvent({
        action: 'undo_step',
        category: 'history',
        label: activeNode.parentId,
      });
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
      setCurrentNodeId(nextId);
      trackEvent({
        action: 'redo_step',
        category: 'history',
        label: nextId,
      });
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleResetAll = () => {
    if (Object.keys(tree).length > 1) {
      setResetHistoryModalOpen(true);
    }
  };

  const handleStepClick = (id: string) => {
    setCurrentNodeId(id);
    trackEvent({
      action: 'select_step',
      category: 'history',
      label: id,
    });
    setSourcePath(null);
    setHoverPath(null);
    onCloseMobile?.();
  };

  const [exportPreviewActive, setExportPreview] = useAtom(exportPreviewActiveAtom);
  const exportScope = getDerivationScope(tree, currentNodeId);
  // The timeline lists every node (incl. off-path branches), so the export-scope
  // preview dims the ones not on the active path (#46, option B).
  const activePathIds = React.useMemo(() => getActivePathIds(tree, currentNodeId), [tree, currentNodeId]);

  const sortedNodes = React.useMemo(() => {
    return Object.values(tree).sort((a, b) => a.timestamp - b.timestamp);
  }, [tree]);

  const stepIndices = React.useMemo(() => {
    const indices = new Map<string, number>();
    sortedNodes.forEach((n, idx) => indices.set(n.id, idx));
    return indices;
  }, [sortedNodes]);

  const activeItemRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (activeItemRef.current) {
        activeItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentNodeId]);

  return (
    <div className="flex flex-col gap-4 py-2 text-white">
      {/* Header toolbar */}
      <div className={`flex items-center justify-between ${THEME_GLASS.PANEL_HEADER} shrink-0`}>
        <span className="text-sm font-semibold text-indigo-300">Steps Timeline</span>
        <div className="flex items-center gap-2">
          <CopyFormatMenu
            getText={(format) => formatDerivation(tree, currentNodeId, format)}
            iconSize={16}
            variant="panel"
            tooltip={<HotkeyHint label="Copy full derivation" />}
            disabled={isHydrated ? sortedNodes.length <= 1 : undefined}
            trackAction="copy_derivation"
            trackCategory="history"
            trackLabel={currentNodeId}
            scopeLabel={`Full derivation · ${exportScope.stepCount} ${exportScope.stepCount === 1 ? 'step' : 'steps'}`}
            scopeEquation={exportScope.endpoint}
            onPreviewChange={setExportPreview}
          />
          <button
            onClick={handleUndo}
            disabled={isHydrated ? !canUndo : undefined}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Undo (⌘Z)"
            aria-label="Undo step"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={isHydrated ? !canRedo : undefined}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Redo (⌘⇧Z)"
            aria-label="Redo step"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleResetAll}
            disabled={isHydrated ? sortedNodes.length <= 1 : undefined}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-red-400 hover:text-red-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Reset All"
            aria-label="Reset history"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Timeline items list */}
      <div className={`relative flex flex-col gap-6 pl-4 border-l ${THEME_GLASS.PANEL_BORDER} ml-2 py-2`}>
        {sortedNodes.map((node, idx) => {
          const isCurrent = node.id === currentNodeId;
          const parentIndex = node.parentId ? stepIndices.get(node.parentId) : null;
          const isBranch = parentIndex !== null && idx > 0 && sortedNodes[idx - 1].id !== node.parentId;

          return (
            <div
              key={node.id}
              ref={isCurrent ? activeItemRef : undefined}
              onClick={() => handleStepClick(node.id)}
              className={`relative flex flex-col gap-1 cursor-pointer group select-none ${exportPreviewActive && !activePathIds.has(node.id) ? THEME_GLASS.COPY_PREVIEW_DIMMED : ''}`}
            >
              {/* Left timeline badge/dot */}
              <div
                className={`absolute -left-[25px] top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[0.5rem] font-bold transition-all duration-300 ${
                  isCurrent
                    ? THEME_GLASS.TIMELINE_BADGE_ACTIVE
                    : THEME_GLASS.TIMELINE_BADGE_DEFAULT
                }`}
              >
                {idx}
              </div>

              {/* Step label / math string card */}
              <div
                className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? THEME_GLASS.TIMELINE_CARD_ACTIVE
                    : THEME_GLASS.TIMELINE_CARD_DEFAULT
                }`}
              >
                <div className={`flex items-center justify-between text-xs ${THEME_GLASS.TEXT_MUTED} font-semibold tracking-wider`}>
                  <span className={isCurrent ? 'text-indigo-400 font-bold' : ''}>
                    {node.label}
                  </span>
                  {isBranch && parentIndex !== null && (
                    <span className="text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/10 font-sans tracking-normal text-[0.5rem]">
                      Branch from step {parentIndex}
                    </span>
                  )}
                </div>

                <div className="text-sm font-mono text-white tracking-wide break-all">
                  {equationToString(node.equation)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
