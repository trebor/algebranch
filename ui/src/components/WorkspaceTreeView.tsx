// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { TooltipCard } from './TooltipCard';
import { CopyFormatMenu } from './CopyFormatMenu';
import { equationToString, getEquationStatus } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { sentenceCase } from '../utils/text';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  treeLayoutAtom,
  sourcePathAtom,
  hoverPathAtom,
  hoveredLoopTargetIdAtom,
  getCanonicalKey,
  rightSidebarOpenAtom,
  exportPreviewActiveAtom,
  equationToFormat,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Check, CircleSlash, Infinity, Replace, TriangleAlert } from 'lucide-react';
import { useIsHydrated } from '../hooks/useIsHydrated';

// Top offset (Tailwind class) for each vertical slot in the stack of badges
// pinned to a tree node's top-right corner. Badges fill slots top-down in a
// fixed priority order so multiple badges never overlap.
const TREE_NODE_BADGE_SLOT_TOP = ['-top-1.5', 'top-3', 'top-[30px]'] as const;

// Shared dashed-flow treatment so the loop connector and the export-path preview
// animate identically (same dash pattern + speed) (#46).
const FLOW_DASH_ARRAY = '5, 5';
const FLOW_DASH_ANIMATION = 'dash 30s linear infinite';

interface WorkspaceTreeViewProps {
  /** When false, the tree is a read-only preview: node clicks don't navigate
   *  and the cards lose their pointer affordance. Defaults to true. */
  interactive?: boolean;
  /** Smoothly scroll the active node into view when it changes. Defaults to true. */
  scrollActiveIntoView?: boolean;
  /** Called after an interactive node selection (e.g. to close a mobile panel). */
  onAfterSelect?: () => void;
  /** Override the scroll-container classes (e.g. a capped height in a modal). */
  className?: string;
}

/**
 * The workspace derivation graph — the SVG-connected node tree shown in the
 * History panel. Reads the live workspace atoms, so every mount renders the same
 * current derivation; pass `interactive={false}` for a read-only preview (used by
 * the Feedback modal so the user sees exactly what a `?ws=` link would share).
 */
export const WorkspaceTreeView: React.FC<WorkspaceTreeViewProps> = ({
  interactive = true,
  scrollActiveIntoView = true,
  onAfterSelect,
  className,
}) => {
  const [tree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);
  const layout = useAtomValue(treeLayoutAtom);
  const [hoveredLoopTargetId, setHoveredLoopTargetId] = useAtom(hoveredLoopTargetIdAtom);
  const exportPreviewActive = useAtomValue(exportPreviewActiveAtom);
  const isMounted = useIsHydrated();

  const activeCardRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!scrollActiveIntoView) return;
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
  }, [currentNodeId, scrollActiveIntoView]);

  const handleStepClick = (id: string) => {
    if (!interactive) return;
    setCurrentNodeId(id);
    trackEvent({
      action: 'select_step',
      category: 'history',
      label: id,
    });
    setSourcePath(null);
    setHoverPath(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setRightSidebarOpen(false);
    }
    onAfterSelect?.();
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
    <div className={className ?? `flex-1 overflow-auto pr-1 relative ${THEME_GLASS.TREE_BG}`}>
      <div
        style={
          interactive
            ? { width: `${svgWidth}px`, height: `${svgHeight}px`, minWidth: '100%' }
            : { width: `${svgWidth}px`, height: `${svgHeight}px` }
        }
        className={interactive ? 'relative' : 'relative mx-auto'}
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
                let startX = 0;
                let startY = 0;
                let endX = 0;
                let endY = 0;
                let cp1x = 0;
                let cp1y = 0;
                let cp2x = 0;
                let cp2y = 0;

                const isCollateral = Math.abs(ancestor.y - node.y) < 10;
                const isAncestorAbove = ancestor.y < node.y;

                if (isCollateral) {
                  const inBetweenNodes = visualNodes.filter(n =>
                    n.id !== ancestor.id &&
                    n.id !== node.id &&
                    Math.abs(n.y - ancestor.y) < 10 &&
                    n.x > Math.min(ancestor.x, node.x) &&
                    n.x < Math.max(ancestor.x, node.x)
                  );
                  const hasObstacle = inBetweenNodes.length > 0;
                  const archOffset = hasObstacle ? 50 : 0;

                  if (ancestor.x < node.x) {
                    startX = node.x + (node.width - 44) / 2;
                    startY = node.y + cardHeight / 2;
                    endX = ancestor.x + ancestor.width;
                    endY = ancestor.y + cardHeight / 2;
                  } else {
                    startX = node.x + (node.width + 44) / 2;
                    startY = node.y + cardHeight / 2;
                    endX = ancestor.x;
                    endY = ancestor.y + cardHeight / 2;
                  }

                  cp1x = startX + (endX - startX) * 0.45;
                  cp1y = startY - archOffset;
                  cp2x = startX + (endX - startX) * 0.55;
                  cp2y = endY - archOffset;
                } else if (isAncestorAbove) {
                  startX = node.x + node.width / 2;
                  startY = node.y;
                  endX = ancestor.x + ancestor.width / 2;
                  endY = ancestor.y + cardHeight;

                  cp1x = startX;
                  cp1y = startY + (endY - startY) * 0.45;
                  cp2x = endX;
                  cp2y = startY + (endY - startY) * 0.55;
                } else {
                  startX = node.x + node.width / 2;
                  startY = node.y + cardHeight;
                  endX = ancestor.x + ancestor.width / 2;
                  endY = ancestor.y;

                  cp1x = startX;
                  cp1y = startY + (endY - startY) * 0.45;
                  cp2x = endX;
                  cp2y = startY + (endY - startY) * 0.55;
                }

                const dStr = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

                return (
                  <path
                    key={`loop-${ancestor.id}-${node.id}`}
                    d={dStr}
                    fill="none"
                    stroke={THEME_GLASS.LOOP_LINE_STROKE}
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
                    <div className="flex items-center gap-1 tracking-wider text-[0.5rem] font-bold text-fuchsia-400">
                      <Infinity size={10} />
                      <span>Loop Detected</span>
                    </div>
                    <div className="text-xs lowercase-none normal-case leading-tight">
                      This action leads back to <strong>Step {loopAncestor.stepIndex} ({loopAncestor.label})</strong>.
                    </div>
                    <div className={`text-[0.5625rem] ${THEME_GLASS.TEXT_MUTED} mt-1 italic`}>
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
                  } ${interactive ? '' : 'cursor-default'}`}
                >
                  {/* Step index badge on top-left */}
                  <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center font-bold shadow transition-all duration-300 ${
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
                  description={sentenceCase(node.change?.text)}
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
                } ${exportPreviewActive && !isActive ? THEME_GLASS.COPY_PREVIEW_DIMMED : ''} ${interactive ? '' : 'cursor-default'}`}
              >
                {/* Step index badge on top-left */}
                <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center font-bold shadow transition-all duration-300 ${
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
                    <span className={`h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center shadow transition-all duration-300 ${THEME_GLASS.TREE_NODE_BADGE_SUBSTITUTE}`}>
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
                    <span className={`h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center shadow transition-all duration-300 ${THEME_GLASS.TREE_NODE_BADGE_RESTRICTION}`}>
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
                    <span className={`h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center shadow transition-all duration-300 ${isContradiction ? THEME_GLASS.TREE_NODE_BADGE_CONTRADICTION : THEME_GLASS.TREE_NODE_BADGE_IDENTITY}`}>
                      {isContradiction ? <CircleSlash size={9} /> : <Check size={9} />}
                    </span>
                  </Tooltip>
                )}

                {/* Truncated Equation Label */}
                <span className={`text-xs font-mono truncate max-w-full text-indigo-50 font-semibold text-center ${interactive ? 'pl-2 pr-12' : 'px-2'}`}>
                  {equationToString(node.equation)}
                </span>

                {/* Hover Actions Toolbar — omitted in read-only preview mode
                    (e.g. the Feedback modal), where copying a step isn't useful. */}
                {interactive && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 contextual-actions z-20">
                    <CopyFormatMenu
                      getText={(format) => equationToFormat(node.equation, format)}
                      iconSize={10}
                      triggerClassName={`p-1 rounded-md border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-neutral-950 ${THEME_GLASS.TEXT_MUTED} hover:text-white hover:bg-white/10 hover:border-white/15 cursor-pointer`}
                      copiedClassName="text-emerald-400 hover:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 opacity-100"
                      tooltip={<HotkeyHint label="Copy equation" sequence={['C', 'E']} />}
                      tooltipPosition="top"
                      trackAction="copy_step"
                      trackCategory="history"
                      trackLabel={node.id}
                      scopeLabel="This step"
                      scopeDetail={equationToFormat(node.equation, 'unicode')}
                      stopPropagation
                    />
                  </div>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};
