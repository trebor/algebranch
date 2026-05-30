'use client';

import React from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Equation, equationToString } from 'math-engine';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  treeLayoutAtom,
  sourcePathAtom,
  hoverPathAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, Copy, Check, BookOpen } from 'lucide-react';

const COPIED_TIMEOUT = 2000;

export const ControlPanel: React.FC = () => {
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const layout = useAtomValue(treeLayoutAtom);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const handleCopyStep = (e: React.MouseEvent, node: Equation, id: string) => {
    e.stopPropagation();
    const eqStr = equationToString(node);
    navigator.clipboard.writeText(eqStr).then(() => {
      setCopiedId(id);
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
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setCurrentNodeId(activeNode.childrenIds[activeNode.childrenIds.length - 1]);
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleResetAll = () => {
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
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleStepClick = (id: string) => {
    setCurrentNodeId(id);
    setSourcePath(null);
    setHoverPath(null);
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
    const containerWidth = 240; // Printable area inside sidebar
    const minColWidth = 110;

    return layoutNodes.map(node => {
      const rowNodes = nodesByDepth[node.depth] || [node];
      const rowNodeCount = rowNodes.length;
      const sortedIdx = rowNodes.findIndex(n => n.id === node.id);
      
      const rowColWidth = Math.max(minColWidth, containerWidth / rowNodeCount);
      const cardWidth = rowColWidth - 12; // 12px gap spacing
      
      const x = 16 + sortedIdx * rowColWidth; // 16px padding left
      const y = 20 + node.depth * 76; // 76px ROW_HEIGHT

      return {
        ...node,
        x,
        y,
        width: cardWidth,
      };
    });
  }, [layoutNodes]);

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
    <div className={`w-full h-full flex flex-col gap-6 p-5 ${THEME_GLASS.PANEL}`}>
      {/* Sidebar Header with Timeline Actions */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 select-none">
          <BookOpen className="text-indigo-400" size={18} />
          <span>Derivations</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            title="Undo (Parent Step)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            title="Redo (Child Step)"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleResetAll}
            disabled={Object.keys(tree).length <= 1}
            className={`p-1.5 rounded-lg border border-white/10 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            title="Reset Derivation Tree"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Step History Tree Section */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 select-none shrink-0">
          Derivations Tree
        </h3>

        {/* Scrollable grid area for the Tree */}
        <div className="flex-1 overflow-auto pr-1 relative border border-white/5 rounded-2xl bg-black/10 shadow-inner">
          <div 
            style={{ width: `${svgWidth}px`, height: `${svgHeight}px`, minWidth: '100%' }}
            className="relative"
          >
            {/* SVG Connection Lines */}
            <svg 
              style={{ width: `${svgWidth}px`, height: `${svgHeight}px` }} 
              className="absolute inset-0 pointer-events-none z-0"
            >
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
            </svg>

            {/* Tree Node Bubbles */}
            {visualNodes.map((node) => {
              const isActive = node.id === currentNodeId;
              const stepNum = stepIndices.get(node.id) ?? 0;
              const isCopied = copiedId === node.id;

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${cardHeight}px`,
                  }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleStepClick(node.id)}
                  className={`z-10 rounded-xl flex flex-col items-center justify-center border select-none cursor-pointer transition-all duration-300 relative group/node p-1.5 ${
                    isActive
                      ? 'border-indigo-400/85 text-indigo-300 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.25)] scale-[1.02]'
                      : 'border-white/5 hover:border-white/12 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 shadow-md'
                  }`}
                >
                  {/* Step index badge on top-left */}
                  <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[8px] flex items-center justify-center font-bold shadow transition-all duration-300 ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-400 text-indigo-100'
                      : 'bg-neutral-900 border-white/10 text-white/60'
                  }`}>
                    {stepNum}
                  </span>

                  {/* Truncated Equation Label */}
                  <span className="text-[11px] font-mono truncate max-w-full text-indigo-50 font-semibold px-2 text-center">
                    {equationToString(node.equation)}
                  </span>

                  {/* Floating Glassmorphic Tooltip */}
                  {hoveredId === node.id && (
                    <div 
                      className="absolute bottom-[115%] left-1/2 -translate-x-1/2 z-30 w-56 p-3 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-md shadow-2xl flex flex-col gap-1.5 pointer-events-auto select-text text-left animate-in fade-in duration-200"
                      onClick={(e) => e.stopPropagation()} // Prevents selection click when clicking tooltip
                    >
                      <div className="text-indigo-400 font-bold tracking-wider uppercase text-[8px] flex items-center justify-between">
                        <span>{node.label}</span>
                        <button
                          onClick={(e) => handleCopyStep(e, node.equation, node.id)}
                          className={`p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white cursor-pointer transition-colors ${
                            isCopied ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : ''
                          }`}
                          title="Copy Equation"
                        >
                          {isCopied ? <Check size={8} /> : <Copy size={8} />}
                        </button>
                      </div>
                      <div className="text-[11px] font-mono text-indigo-50 font-semibold break-all leading-tight">
                        {equationToString(node.equation)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
