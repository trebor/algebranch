'use client';

import React from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Tooltip } from './Tooltip';
import { PreviewEquationNode } from './PreviewEquationNode';
import { Equation, equationToString } from 'math-engine-client';
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
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, Copy, Check, GitFork, Infinity } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';

const COPIED_TIMEOUT = 2000;

interface ControlPanelProps {
  onCloseMobile?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ onCloseMobile }) => {
  const isMobile = useIsMobile();
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const layout = useAtomValue(treeLayoutAtom);
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);


  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [hoveredLoopTargetId, setHoveredLoopTargetId] = useAtom(hoveredLoopTargetIdAtom);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleCopyStep = (e: React.MouseEvent, node: Equation, id: string) => {
    e.stopPropagation();
    const eqStr = equationToString(node);
    navigator.clipboard.writeText(eqStr).then(() => {
      setCopiedId(id);
      trackEvent({
        action: 'copy_step',
        category: 'history',
        label: id,
      });
      setTimeout(() => {
        setCopiedId(null);
      }, COPIED_TIMEOUT);
    });
  };

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
      isMobile 
        ? 'p-0 bg-transparent' 
        : `${THEME_GLASS.PANEL} p-4`
    }`}>
      {/* Sidebar Header with Timeline Actions */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <h2 className="text-base lg:text-lg font-semibold lg:font-bold text-white flex items-center gap-2 select-none">
          <GitFork className="text-indigo-400 rotate-180" size={18} />
          <span>History</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <Tooltip content="Undo step (⌘Z)">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Redo step (⌘⇧Z)">
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Reset history">
            <button
              onClick={handleResetAll}
              disabled={Object.keys(tree).length <= 1}
              className={`p-1.5 rounded-lg border border-white/10 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
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
                return (
                  <path
                    key={`${parent.id}-${child.id}`}
                    d={d}
                    fill="none"
                    stroke={child.isActive ? "rgba(129, 140, 248, 0.6)" : "rgba(255, 255, 255, 0.12)"}
                    strokeWidth={child.isActive ? 2.5 : 1.5}
                    className="transition-all duration-300"
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
                        strokeDasharray="5, 5"
                        className="transition-all duration-300 animate-dash"
                        style={{
                          animation: 'dash 30s linear infinite',
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
              const isCopied = copiedId === node.id;
              const stepNum = stepIndices.get(node.id) ?? 0;

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
                        <div className="text-[9px] text-white/40 mt-1 italic">
                          Click to select and return to Step {loopAncestor.stepIndex}.
                        </div>
                      </div>
                    }
                  >
                    <div
                      onClick={() => handleStepClick(loopAncestor.id)} // Selects and jumps back to the original ancestor!
                      onMouseEnter={() => setHoveredLoopTargetId(loopAncestor.id)}
                      onMouseLeave={() => setHoveredLoopTargetId(null)}
                      className={`w-11 h-11 rounded-full flex items-center justify-center border select-none cursor-pointer transition-all duration-300 relative group/node ${
                        isLoopHighlight
                          ? 'border-fuchsia-500 bg-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.45)] scale-[1.05]'
                          : 'border-fuchsia-500/40 hover:border-fuchsia-500/80 bg-fuchsia-950/60 hover:bg-fuchsia-950/80 text-fuchsia-400 hover:text-fuchsia-300 shadow-md shadow-fuchsia-950/20'
                      }`}
                    >
                      {/* Step index badge on top-left */}
                      <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[8px] flex items-center justify-center font-bold shadow transition-all duration-300 ${
                        isLoopHighlight
                          ? 'bg-fuchsia-600 border-fuchsia-400 text-fuchsia-100'
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
                  className="max-w-[85vw] w-max p-4 z-50 text-left lowercase-none normal-case flex flex-col gap-2 pointer-events-auto font-sans bg-neutral-950/98 shadow-[0_0_30px_rgba(99,102,241,0.25)] border border-indigo-500/20"
                  content={
                    <>
                      <div className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase select-none border-b border-indigo-500/10 pb-1.5 mb-1 flex items-center justify-between gap-12">
                        <span>Step Details — {node.label}</span>
                        <span className="text-[9px] text-white/30 font-sans normal-case font-medium">Step {stepNum}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 py-2 overflow-x-auto select-all text-base sm:text-lg font-semibold text-indigo-100">
                        <PreviewEquationNode path="lhs" customEquation={node.equation} />
                        <span className="text-[1.1em] font-mono text-indigo-400 select-none px-2">=</span>
                        <PreviewEquationNode path="rhs" customEquation={node.equation} />
                      </div>
                    </>
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
                    className={`w-full h-full rounded-xl flex flex-col items-center justify-center border select-none cursor-pointer transition-all duration-300 relative group/node p-1.5 ${
                      isLoopHighlight
                        ? 'border-fuchsia-500/80 text-fuchsia-300 bg-fuchsia-500/10 shadow-[0_0_15px_rgba(217,70,239,0.35)] scale-[1.02]'
                        : isCurrent
                        ? 'border-indigo-400/85 text-indigo-300 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.25)] scale-[1.02]'
                        : 'border-white/5 hover:border-white/12 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 shadow-md'
                    }`}
                  >
                    {/* Step index badge on top-left */}
                    <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[8px] flex items-center justify-center font-bold shadow transition-all duration-300 ${
                      isLoopHighlight
                        ? 'bg-fuchsia-600 border-fuchsia-400 text-fuchsia-100'
                        : isCurrent 
                        ? 'bg-indigo-600 border-indigo-400 text-indigo-100'
                        : 'bg-neutral-900 border-white/10 text-white/60'
                    }`}>
                      {stepNum}
                    </span>

                    {/* Truncated Equation Label */}
                    <span className="text-[11px] font-mono truncate max-w-full text-indigo-50 font-semibold pl-2 pr-12 text-center">
                      {equationToString(node.equation)}
                    </span>

                    {/* Hover Actions Toolbar */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 contextual-actions z-20">

                      <Tooltip content="Copy Equation" position="top">
                        <button
                          onClick={(e) => handleCopyStep(e, node.equation, node.id)}
                          className={`p-1 rounded-md border border-white/5 bg-neutral-950 text-white/40 hover:text-white hover:bg-white/10 hover:border-white/15 cursor-pointer ${
                            isCopied ? 'text-emerald-400 hover:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 opacity-100' : ''
                          }`}
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </Tooltip>
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
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <span className="text-sm font-semibold text-indigo-300">Steps Timeline</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Undo (⌘Z)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Redo (⌘⇧Z)"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleResetAll}
            disabled={sortedNodes.length <= 1}
            className="p-1.5 rounded-lg border border-white/10 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Reset All"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Timeline items list */}
      <div className="relative flex flex-col gap-6 pl-4 border-l border-white/10 ml-2 py-2">
        {sortedNodes.map((node, idx) => {
          const isCurrent = node.id === currentNodeId;
          const parentIndex = node.parentId ? stepIndices.get(node.parentId) : null;
          const isBranch = parentIndex !== null && idx > 0 && sortedNodes[idx - 1].id !== node.parentId;

          return (
            <div
              key={node.id}
              ref={isCurrent ? activeItemRef : undefined}
              onClick={() => handleStepClick(node.id)}
              className="relative flex flex-col gap-1 cursor-pointer group select-none"
            >
              {/* Left timeline badge/dot */}
              <div
                className={`absolute -left-[25px] top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-indigo-600 border-indigo-400 text-white scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                    : 'bg-neutral-900 border-white/20 text-white/50 group-hover:border-indigo-400/50 group-hover:text-indigo-300'
                }`}
              >
                {idx}
              </div>

              {/* Step label / math string card */}
              <div
                className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? 'border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                    : 'border-white/5 bg-neutral-900/60 hover:bg-neutral-900/90 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-white/40 font-semibold uppercase tracking-wider">
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
