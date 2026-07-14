// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { CopyFormatMenu } from './CopyFormatMenu';
import { WorkspaceTreeView } from './WorkspaceTreeView';
import { trackEvent } from '../utils/analytics';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  sourcePathAtom,
  hoverPathAtom,
  resetHistoryModalOpenAtom,
  exportPreviewActiveAtom,
  formatDerivation,
  getDerivationScope,
  getDerivationSteps,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, GitFork } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useIsShortScreen } from '../hooks/useIsShortScreen';
import { useIsHydrated } from '../hooks/useIsHydrated';
import { RovingTabindexProvider, useRovingItem } from '../hooks/useRovingTabindex';

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
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);
  const setExportPreview = useSetAtom(exportPreviewActiveAtom);
  const isHydrated = useIsHydrated();

  const { ref: copyRef, tabIndex: copyTabIndex } = useRovingItem('copy');
  const { ref: undoRef, tabIndex: undoTabIndex, onKeyDown: undoKeyDown } = useRovingItem('undo');
  const { ref: redoRef, tabIndex: redoTabIndex, onKeyDown: redoKeyDown } = useRovingItem('redo');
  const { ref: resetRef, tabIndex: resetTabIndex, onKeyDown: resetKeyDown } = useRovingItem('reset');

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
    <RovingTabindexProvider>
      {/* <aside> (complementary) landmark labelled by the History heading, so the
          right sidebar surfaces in a screen-reader rotor symmetric with the left
          "Equation library" aside (#237). Was a generic role="region" (#257). */}
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
          <h2
            id={headingId}
            className="text-base lg:text-lg font-semibold lg:font-bold text-white flex items-center gap-2 select-none"
          >
            <GitFork className="text-indigo-400 rotate-180" size={18} />
            <span>History</span>
          </h2>
          <div className="flex items-center gap-1.5" role="toolbar" aria-label="History actions">
            <CopyFormatMenu
              tabIndex={copyTabIndex}
              triggerRef={copyRef as React.RefCallback<HTMLButtonElement>}
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
                ref={undoRef as React.RefCallback<HTMLButtonElement>}
                tabIndex={undoTabIndex}
                onKeyDown={undoKeyDown}
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
                ref={redoRef as React.RefCallback<HTMLButtonElement>}
                tabIndex={redoTabIndex}
                onKeyDown={redoKeyDown}
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
                ref={resetRef as React.RefCallback<HTMLButtonElement>}
                tabIndex={resetTabIndex}
                onKeyDown={resetKeyDown}
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
    </RovingTabindexProvider>
  );
};

