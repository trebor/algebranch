// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Tooltip } from './Tooltip';
import { TooltipCard } from './TooltipCard';
import { CopyFormatMenu } from './CopyFormatMenu';
import { equationToString, getEquationStatus } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  treeLayoutAtom,
  sourcePathAtom,
  hoverPathAtom,
  hoveredLoopTargetIdAtom,
  getCanonicalKey,
  rightSidebarOpenAtom,
  resetHistoryModalOpenAtom,
  exportPreviewActiveAtom,
  formatDerivation,
  equationToFormat,
  getDerivationScope,
  getActivePathIds,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, Check, CircleSlash, GitFork, Infinity, Replace, TriangleAlert } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useIsHydrated } from '../hooks/useIsHydrated';

// Top offset (Tailwind class) for each vertical slot in the stack of badges
// pinned to a tree node's top-right corner. Badges fill slots top-down in a
// fixed priority order so multiple badges never overlap.
const TREE_NODE_BADGE_SLOT_TOP = ['-top-1.5', 'top-3', 'top-[30px]'] as const;

// Shared dashed-flow treatment so the loop connector and the export-path preview
// animate identically (same dash pattern + speed) (#46).
const FLOW_DASH_ARRAY = '5, 5';
const FLOW_DASH_ANIMATION = 'dash 30s linear infinite';

interface ControlPanelProps {
  onCloseMobile?: () => void;
  noBorder?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onCloseMobile, noBorder }) => {
  const isMobile = useIsMobile();
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const layout = useAtomValue(treeLayoutAtom);
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);


  const [hoveredLoopTargetId, setHoveredLoopTargetId] = useAtom(hoveredLoopTargetIdAtom);
  const [exportPreviewActive, setExportPreview] = useAtom(exportPreviewActiveAtom);
  const isMounted = useIsHydrated();

  const exportScope = getDerivationScope(tree, currentNodeId);

  const activeCardRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (activeCardRef.current) {
        activeCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentNodeId]);

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

  const handleStepClick = (id: string) => {
    setCurrentNodeId(id);
    trackEvent({
      action: 'select_step',
      category: 'history',
      label: id,
    });
    setSourcePath(null);
    setHoverPath(null);
    if (window.innerWidth < 1024) {
      setRightSidebarOpen(false);
    }
    onCloseMobile?.();
  };

  // Compute permanent chronological indices for visual rendering
  const sortedNodes = React.useMemo(() => {
    return Object.values(tree).sort((a, b) => a.timestamp - b.timestamp);
  }, [tree]);

  const stepIndices = React.useMemo(() => {
    const indices = new Map<string, number>();
    sortedNodes.forEach((n, idx) => indices.set(n.id, idx));
    return indices;
  }, [sortedNodes]);

  const layoutNodes = Object.values(layout);

  // Heuristic Loop Detection: Map each nodeId to the earliest canonically equivalent ancestor node (if a loop exists)
  const loopAncestorMap = React.useMemo(() => {
    const map = new Map<string, { id: string; stepIndex: number; label: string }>();

    layoutNodes.forEach((node) => {
      const nodeIdx = stepIndices.get(node.id) ?? 0;
      const nodeCanonical = getCanonicalKey(node.equation);
      
      // Find the earliest node in the tree that is canonically equivalent to this node
      let earliestNode: typeof sortedNodes[0] | null = null;
      let earliestIdx = nodeIdx;

      for (const otherNode of sortedNodes) {
        if (otherNode.id === node.id) continue;
        const otherIdx = stepIndices.get(otherNode.id) ?? 0;
        if (otherIdx < earliestIdx) {
          if (getCanonicalKey(otherNode.equation) === nodeCanonical) {
            earliestIdx = otherIdx;
            earliestNode = otherNode;
          }
        }
      }

      if (earliestNode) {
        map.set(node.id, {
          id: earliestNode.id,
          stepIndex: earliestIdx,
          label: earliestNode.label,
        });
      }
    });

    return map;
  }, [sortedNodes, stepIndices, layoutNodes]);

  const maxDepth = Math.max(...layoutNodes.map(n => n.depth), 0);
  const cardHeight = 44; // Sleek rectangular height

  // Recalculate dynamic visual nodes coordinates row-by-row!
  const visualNodes = React.useMemo(() => {
    // 1. Group nodes by depth (row)
    const nodesByDepth: Record<number, typeof layoutNodes> = {};
    layoutNodes.forEach(node => {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }
      nodesByDepth[node.depth].push(node);
    });

    // 2. Sort each depth left-to-right by their logical column assignment
    Object.keys(nodesByDepth).forEach(depthStr => {
      const d = Number(depthStr);
      nodesByDepth[d].sort((a, b) => a.column - b.column);
    });

    // 3. Compute dynamic position and width on a row-by-row basis
    const containerWidth = isMounted && typeof window !== 'undefined' && window.innerWidth < 1024
      ? Math.max(240, window.innerWidth - 40)
      : 240;
    const minColWidth = 110;

    return layoutNodes.map(node => {
      const rowNodes = nodesByDepth[node.depth] || [node];
      const rowNodeCount = rowNodes.length;
      const sortedIdx = rowNodes.findIndex(n => n.id === node.id);
      
      const rowColWidth = Math.max(minColWidth, containerWidth / rowNodeCount);
      const maxCardWidth = 228; // Standard elegant desktop width
      const cardWidth = Math.min(maxCardWidth, rowColWidth - 12);
      
      // Center the card in its column cell if it is smaller than the cell width
      const x = 16 + sortedIdx * rowColWidth + (rowColWidth - 12 - cardWidth) / 2;
      const y = 20 + node.depth * 76; // 76px ROW_HEIGHT

      return {
        ...node,
        x,
        y,
        width: cardWidth,
      };
    });
  }, [layoutNodes, isMounted]);

  const visualNodesMap = React.useMemo(() => {
    const map: Record<string, typeof visualNodes[0]> = {};
    visualNodes.forEach(n => map[n.id] = n);
    return map;
  }, [visualNodes]);

  // SVG grid sizing
  const svgWidth = React.useMemo(() => {
    if (visualNodes.length === 0) return 260;
    const maxRight = Math.max(...visualNodes.map(n => n.x + n.width));
    return maxRight + 16; // 16px padding right
  }, [visualNodes]);

  const svgHeight = 40 + maxDepth * 76 + cardHeight;

  // Compute the path of ancestor node IDs from the root up to the active node pointer
  const activePathSet = React.useMemo(() => {
    const pathSet = new Set<string>();
    let currentId: string | null = currentNodeId;
    while (currentId !== null) {
      pathSet.add(currentId);
      currentId = tree[currentId]?.parentId ?? null;
    }
    return pathSet;
  }, [tree, currentNodeId]);

  // Build the link connections
  const connections = React.useMemo(() => {
    const links: { 
      parent: { x: number; y: number; width: number; id: string }; 
      child: { x: number; y: number; width: number; id: string; isActive: boolean } 
    }[] = [];
    visualNodes.forEach((node) => {
      if (node.parentId !== null && visualNodesMap[node.parentId]) {
        const parent = visualNodesMap[node.parentId];
        const isActiveLink = activePathSet.has(parent.id) && activePathSet.has(node.id);
        links.push({
          parent: { x: parent.x, y: parent.y, width: parent.width, id: parent.id },
          child: { x: node.x, y: node.y, width: node.width, id: node.id, isActive: isActiveLink },
        });
      }
    });
    return links;
  }, [visualNodes, visualNodesMap, activePathSet]);

  return (
    <div className={`w-full h-full flex flex-col gap-4 ${
      isMobile || noBorder
        ? 'p-0 bg-transparent' 
        : `${THEME_GLASS.PANEL} p-4`
    }`}>
      {/* Sidebar Header with Timeline Actions */}
      <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER} pb-4 shrink-0`}>
        <Tooltip content="Toggle Sidebar (H)" position="left" autoAlign={false}>
          <h2 
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
            triggerClassName={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer text-white`}
            copiedClassName="text-emerald-400"
            tooltip="Copy full derivation"
            disabled={Object.keys(tree).length <= 1}
            trackAction="copy_derivation"
            trackCategory="history"
            trackLabel={currentNodeId}
            scopeLabel={`Full derivation · ${exportScope.stepCount} ${exportScope.stepCount === 1 ? 'step' : 'steps'}`}
            scopeDetail={exportScope.endpoint}
            onPreviewChange={setExportPreview}
          />
          <Tooltip content="Undo step (⌘Z)">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Redo step (⌘⇧Z)">
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Reset history">
            <button
              onClick={handleResetAll}
              disabled={Object.keys(tree).length <= 1}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <RotateCcw size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Step History Tree Section */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Scrollable grid area for the Tree */}
        <div className={`flex-1 overflow-auto pr-1 relative ${THEME_GLASS.TREE_BG}`}>
          <div 
            style={{ width: `${svgWidth}px`, height: `${svgHeight}px`, minWidth: '100%' }}
            className="relative"
          >
            {/* SVG Connection Lines */}
            <svg 
              style={{ width: `${svgWidth}px`, height: `${svgHeight}px` }} 
              className="absolute inset-0 pointer-events-none z-0"
            >
              <style>{`
                @keyframes dash {
                  to {
                    stroke-dashoffset: -1000;
                  }
                }
              `}</style>
              {connections.map(({ parent, child }) => {
                // Connect parent bottom-center to child top-center dynamically
                const startX = parent.x + parent.width / 2;
                const startY = parent.y + cardHeight;
                const endX = child.x + child.width / 2;
                const endY = child.y;

                const cp1y = startY + (endY - startY) * 0.45;
                const cp2y = startY + (endY - startY) * 0.55;

                const d = `M ${startX} ${startY} C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`;
                // While hovering a full-derivation copy trigger, animate the active
                // path edges with a downward-flowing dash (reusing the loop's `dash`
                // keyframe) to show direction of travel root -> selected (#46, opt B).
                const isPreviewPath = exportPreviewActive && child.isActive;
                return (
                  <path
                    key={`${parent.id}-${child.id}`}
                    d={d}
                    fill="none"
                    stroke={isPreviewPath ? "rgba(165, 180, 252, 0.95)" : child.isActive ? "rgba(129, 140, 248, 0.6)" : "rgba(255, 255, 255, 0.12)"}
                    strokeWidth={isPreviewPath ? 3 : child.isActive ? 2.5 : 1.5}
                    strokeDasharray={isPreviewPath ? FLOW_DASH_ARRAY : undefined}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                    style={isPreviewPath ? { animation: FLOW_DASH_ANIMATION } : undefined}
                  />
                );
              })}

              {/* Dynamic loop-connecting dashed line (Echo high-fidelity curve) */}
              {hoveredLoopTargetId && visualNodes.map(node => {
                const loopAncestor = loopAncestorMap.get(node.id);
                if (loopAncestor && hoveredLoopTargetId === loopAncestor.id) {
                  const ancestor = visualNodesMap[loopAncestor.id];
                  if (ancestor) {
                    const startX = ancestor.x + ancestor.width / 2;
                    const startY = ancestor.y + cardHeight;
                    const endX = node.x + node.width / 2;
                    const endY = node.y;

                    const cp1y = startY + (endY - startY) * 0.45;
                    const cp2y = startY + (endY - startY) * 0.55;
                    const dStr = `M ${startX} ${startY} C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`;

                    return (
                      <path
                        key={`loop-${ancestor.id}-${node.id}`}
                        d={dStr}
                        fill="none"
                        stroke="rgba(217, 70, 239, 0.85)"
                        strokeWidth={2.5}
                        strokeDasharray={FLOW_DASH_ARRAY}
                        className="transition-all duration-300 animate-dash"
                        style={{
                          animation: FLOW_DASH_ANIMATION,
                        }}
                      />
                    );
                  }
                }
                return null;
              })}
            </svg>

            {/* Tree Node Bubbles */}
            {visualNodes.map((node) => {
              const loopAncestor = loopAncestorMap.get(node.id);
              const isActive = activePathSet.has(node.id);
              const isCurrent = currentNodeId === node.id;
              const isLoopHighlight = hoveredLoopTargetId === node.id || (loopAncestor && hoveredLoopTargetId === loopAncestor.id);
              const stepNum = stepIndices.get(node.id) ?? 0;

              // Right-corner badges stack top-down in a fixed priority order:
              // substitute → restriction → contradiction/identity. Each present
              // badge claims the next slot, so its vertical offset is just the
              // count of higher-priority badges that are showing.
              const eqStatus = getEquationStatus(node.equation);
              const hasSubstituteBadge = node.change?.op === 'substitute';
              const hasRestrictionBadge = !!node.change?.assumptions?.length;
              const isContradiction = eqStatus === 'contradiction';
              const isIdentity = eqStatus === 'identity';
              const substituteSlot = 0;
              const restrictionSlot = hasSubstituteBadge ? 1 : 0;
              const statusSlot =
                (hasSubstituteBadge ? 1 : 0) + (hasRestrictionBadge ? 1 : 0);

              if (loopAncestor) {
                // Render Compact Loop Terminal Bubble!
                return (
                  <Tooltip
                    key={node.id}
                    position="right"
                    delay={300} // Snappy but deliberate 300ms hover delay to prevent jitter
                    wrapperClassName="z-10 absolute"
                    style={{
                      left: `${node.x + (node.width - 44) / 2}px`, // Center the 44px bubble in the column
                      top: `${node.y}px`,
                      width: `44px`,
                      height: `${cardHeight}px`,
                    }}
                    className="w-56 p-3 z-50 text-left lowercase-none normal-case flex flex-col gap-1.5 pointer-events-auto"
                    content={
                      <div className="flex flex-col gap-0.5 text-fuchsia-300 font-semibold p-1">
                        <div className="flex items-center gap-1 uppercase tracking-wider text-[8px] font-bold text-fuchsia-400">
                          <Infinity size={10} />
                          <span>Loop Detected</span>
                        </div>
                        <div className="text-[10px] lowercase-none normal-case leading-tight">
                          This action leads back to <strong>Step {loopAncestor.stepIndex} ({loopAncestor.label})</strong>.
                        </div>
                        <div className={`text-[9px] ${THEME_GLASS.TEXT_MUTED} mt-1 italic`}>
                          Click to select and return to Step {loopAncestor.stepIndex}.
                        </div>
                      </div>
                    }
                  >
                    <div
                      onClick={() => handleStepClick(loopAncestor.id)} // Selects and jumps back to the original ancestor!
                      onMouseEnter={() => setHoveredLoopTargetId(loopAncestor.id)}
                      onMouseLeave={() => setHoveredLoopTargetId(null)}
                      className={`w-11 h-11 rounded-full flex items-center justify-center border select-none transition-all duration-300 relative group/node ${
                        isLoopHighlight
                          ? THEME_GLASS.LOOP_NODE_ACTIVE
                          : THEME_GLASS.LOOP_NODE_DEFAULT
                      }`}
                    >
                      {/* Step index badge on top-left */}
                      <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[8px] flex items-center justify-center font-bold shadow transition-all duration-300 ${
                        isLoopHighlight
                          ? THEME_GLASS.TREE_NODE_BADGE_LOOP
                          : 'bg-fuchsia-950 border-fuchsia-500/30 text-fuchsia-400'
                      }`}>
                        {stepNum}
                      </span>

                      {/* Infinite Loop Icon in Center */}
                      <Infinity size={18} className="stroke-[2.5]" />
                    </div>
                  </Tooltip>
                );
              }

              return (
                <Tooltip
                  key={node.id}
                  position="right"
                  delay={300} // Snappy but deliberate 300ms hover delay to prevent jitter
                  wrapperClassName="z-10 absolute"
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${cardHeight}px`,
                  }}
                  className={`max-w-[85vw] w-max p-4 z-50 text-left lowercase-none normal-case flex flex-col gap-2 pointer-events-auto font-sans ${THEME_GLASS.TOOLTIP_DETAILS}`}
                  content={
                    <TooltipCard
                      eyebrow={`Step Details — ${node.label}`}
                      meta={`Step ${stepNum}`}
                      description={node.change?.text}
                      assumptions={node.change?.assumptions}
                      equation={node.equation}
                    />
                  }
                >
                  <div
                    ref={isCurrent ? activeCardRef : undefined}
                    onClick={() => handleStepClick(node.id)}
                    onMouseEnter={() => {
                      setHoveredLoopTargetId(node.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredLoopTargetId(null);
                    }}
                    className={`w-full h-full rounded-xl flex flex-col items-center justify-center border select-none transition-all duration-300 relative group/node ${
                      isLoopHighlight
                        ? THEME_GLASS.TREE_NODE_LOOP
                        : isCurrent
                        ? THEME_GLASS.TREE_NODE_ACTIVE
                        : THEME_GLASS.TREE_NODE_DEFAULT
                    } ${exportPreviewActive && !isActive ? THEME_GLASS.COPY_PREVIEW_DIMMED : ''}`}
                  >
                    {/* Step index badge on top-left */}
                    <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[8px] flex items-center justify-center font-bold shadow transition-all duration-300 ${
                      isLoopHighlight
                        ? THEME_GLASS.TREE_NODE_BADGE_LOOP
                        : isCurrent
                        ? THEME_GLASS.TREE_NODE_BADGE_ACTIVE
                        : THEME_GLASS.TREE_NODE_BADGE_DEFAULT
                    }`}>
                      {stepNum}
                    </span>

                    {/* Substitution badge (#3): marks steps produced by substituting
                        a fact from another workspace */}
                    {hasSubstituteBadge && (
                      <Tooltip
                        content="Substituted from another workspace"
                        position="top"
                        className="w-max max-w-[240px] text-center text-sm"
                        wrapperClassName={`z-20 absolute ${TREE_NODE_BADGE_SLOT_TOP[substituteSlot]} -right-1.5`}
                      >
                        <span className={`h-4 w-4 rounded-full border text-[8px] flex items-center justify-center shadow transition-all duration-300 ${THEME_GLASS.TREE_NODE_BADGE_SUBSTITUTE}`}>
                          <Replace size={9} />
                        </span>
                      </Tooltip>
                    )}

                    {/* Domain-restriction badge (#63): marks steps that assume an
                        expression is non-zero (cancellation / division by a variable),
                        so the caveat is visible on the tree, not just in the tooltip.
                        Stacks below the substitute badge in case both apply. */}
                    {hasRestrictionBadge && (
                      <Tooltip
                        content={`Valid only if ${node.change?.assumptions?.join(' and ')}`}
                        position="top"
                        className="w-max max-w-[240px] text-center text-sm"
                        wrapperClassName={`z-20 absolute ${TREE_NODE_BADGE_SLOT_TOP[restrictionSlot]} -right-1.5`}
                      >
                        <span className={`h-4 w-4 rounded-full border text-[8px] flex items-center justify-center shadow transition-all duration-300 ${THEME_GLASS.TREE_NODE_BADGE_RESTRICTION}`}>
                          <TriangleAlert size={9} />
                        </span>
                      </Tooltip>
                    )}

                    {/* Contradiction / identity badge (#92): flags terminal states
                        that collapsed to a constant relation — a contradiction
                        (e.g. 3 = -3, no solution) or an identity (e.g. 0 = 0,
                        always true). Stacks below any substitute/restriction badge. */}
                    {(isContradiction || isIdentity) && (
                      <Tooltip
                        content={isContradiction
                          ? 'Contradiction — this statement is false, so there is no solution'
                          : 'Identity — this statement is always true'}
                        position="top"
                        className="w-max max-w-[240px] text-center text-sm"
                        wrapperClassName={`z-20 absolute ${TREE_NODE_BADGE_SLOT_TOP[statusSlot]} -right-1.5`}
                      >
                        <span className={`h-4 w-4 rounded-full border text-[8px] flex items-center justify-center shadow transition-all duration-300 ${isContradiction ? THEME_GLASS.TREE_NODE_BADGE_CONTRADICTION : THEME_GLASS.TREE_NODE_BADGE_IDENTITY}`}>
                          {isContradiction ? <CircleSlash size={9} /> : <Check size={9} />}
                        </span>
                      </Tooltip>
                    )}

                    {/* Truncated Equation Label */}
                    <span className="text-[11px] font-mono truncate max-w-full text-indigo-50 font-semibold pl-2 pr-12 text-center">
                      {equationToString(node.equation)}
                    </span>

                    {/* Hover Actions Toolbar */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 contextual-actions z-20">

                      <CopyFormatMenu
                        getText={(format) => equationToFormat(node.equation, format)}
                        iconSize={10}
                        triggerClassName={`p-1 rounded-md border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-neutral-950 ${THEME_GLASS.TEXT_MUTED} hover:text-white hover:bg-white/10 hover:border-white/15 cursor-pointer`}
                        copiedClassName="text-emerald-400 hover:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 opacity-100"
                        tooltip="Copy equation"
                        tooltipPosition="top"
                        trackAction="copy_step"
                        trackCategory="history"
                        trackLabel={node.id}
                        scopeLabel="This step"
                        scopeDetail={equationToFormat(node.equation, 'unicode')}
                        stopPropagation
                      />
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TimelineContentProps {
  onCloseMobile?: () => void;
}

export const TimelineContent: React.FC<TimelineContentProps> = ({ onCloseMobile }) => {
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);

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
            triggerClassName={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer text-white`}
            copiedClassName="text-emerald-400"
            tooltip="Copy full derivation"
            disabled={sortedNodes.length <= 1}
            trackAction="copy_derivation"
            trackCategory="history"
            trackLabel={currentNodeId}
            scopeLabel={`Full derivation · ${exportScope.stepCount} ${exportScope.stepCount === 1 ? 'step' : 'steps'}`}
            scopeDetail={exportScope.endpoint}
            onPreviewChange={setExportPreview}
          />
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Undo (⌘Z)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Redo (⌘⇧Z)"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleResetAll}
            disabled={sortedNodes.length <= 1}
            className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} text-red-400 hover:text-red-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer`}
            title="Reset All"
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
                className={`absolute -left-[25px] top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all duration-300 ${
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
                <div className={`flex items-center justify-between text-[10px] ${THEME_GLASS.TEXT_MUTED} font-semibold uppercase tracking-wider`}>
                  <span className={isCurrent ? 'text-indigo-400 font-bold' : ''}>
                    {node.label}
                  </span>
                  {isBranch && parentIndex !== null && (
                    <span className="text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/10 font-sans tracking-normal uppercase text-[8px]">
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
