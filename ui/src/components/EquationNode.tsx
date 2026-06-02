'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import * as math from 'mathjs';
import {
  sourcePathAtom,
  hoverPathAtom,
  targetPathsAtom,
  pushEquationAtom,
  currentEquationAtom,
  candidatePathsAtom,
  hoverReducePathAtom,
  reduciblePathsAtom,
  toggleRootSignAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { getNodeByPath, getFunctionName, getChildren } from 'math-engine-client';
import { Sparkles, Zap } from 'lucide-react';

interface EquationNodeProps {
  readonly path: string;
}

/**
 * Helper to check if a node at path can toggle its root sign.
 */
const canToggleRoot = (eq: math.MathNode | unknown): boolean => {
  const node = eq as math.MathNode;
  if (!node) return false;

  if (node.type === 'FunctionNode') {
    const fnNode = node as math.FunctionNode;
    const nameStr = getFunctionName(fnNode);
    return nameStr === 'sqrt';
  }

  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '-' && (node as math.OperatorNode).isUnary()) {
    const child = (node as math.OperatorNode).args[0];
    if (child && child.type === 'FunctionNode') {
      const childFn = child as math.FunctionNode;
      const nameStr = getFunctionName(childFn);
      return nameStr === 'sqrt';
    }
  }

  return false;
};

export const EquationNode: React.FC<EquationNodeProps> = ({ path }) => {
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  const [hoverPath, setHoverPath] = useAtom(hoverPathAtom);
  const setHoverReducePath = useSetAtom(hoverReducePathAtom);
  const reduciblePaths = useAtomValue(reduciblePathsAtom);
  const targetPaths = useAtomValue(targetPathsAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const candidatePaths = useAtomValue(candidatePathsAtom);
  const toggleRootSign = useSetAtom(toggleRootSignAtom);

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(currentEq, path);
    } catch {
      return null;
    }
  }, [currentEq, path]);

  const nodeId = node ? (node as unknown as { id?: string }).id || '' : '';

  if (!node) return null;

  const getChildId = (index: number): string => {
    try {
      const children = getChildren(node);
      if (children && children[index]) {
        return (children[index] as unknown as { id?: string }).id || `${path}/${index}`;
      }
    } catch {}
    return `${path}/${index}`;
  };

  const getOpStyle = (isDivElement: boolean = false): React.CSSProperties => {
    const displayStyle = isDivElement ? {} : { display: 'inline-block' };
    return {
      ...displayStyle,
      maxWidth: '200px',
      transition: 'all 150ms ease-in-out',
    };
  };

  const isSelected = sourcePath === path;
  const isHovered = hoverPath === path;
  const isTarget = !!sourcePath && path in targetPaths;
  const isCandidate = candidatePaths.has(path);
  const isStatic = sourcePath
    ? (!isSelected && !isTarget)
    : !isCandidate;

  // Determine if the user is hovering over any candidate node (or inside one)
  const isHoveringAnyCandidate = React.useMemo(() => {
    if (hoverPath === null) return false;
    if (candidatePaths.has(hoverPath)) return true;
    const parts = hoverPath.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (candidatePaths.has(ancestorPath)) {
        return true;
      }
    }
    return false;
  }, [hoverPath, candidatePaths]);

  const reducedEq = reduciblePaths[path];
  const isReducible = !!reducedEq;

  const handleReduceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reducedEq) {
      pushEquation(reducedEq);
      setHoverReducePath(null);
    }
  };

  // Toggle Root Sign (+/- branches) via global action
  const handleToggleRootSign = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRootSign(path);
  };

  const getTargetPath = (): string | null => {
    if (!sourcePath) return null;
    if (isTarget) return path;
    const parts = path.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (ancestorPath in targetPaths) {
        return ancestorPath;
      }
    }
    return null;
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isStatic) {
      return;
    }

    const activeTargetPath = getTargetPath();
    if (activeTargetPath && sourcePath) {
      pushEquation(targetPaths[activeTargetPath]);
      return;
    }

    // Toggle select
    if (isSelected) {
      setSourcePath(null);
    } else {
      setSourcePath(path);
    }
  };

  // Styling hooks
  const canClick = sourcePath ? (isSelected || isTarget) : isCandidate;
  const canHover = sourcePath ? (isSelected || isTarget) : isCandidate;

  // Only dim candidate nodes if the user is actively hovering over *some* valid candidate.
  // Otherwise, if they hover static parts of the expression, keep all candidates bright (scan mode).
  const isHighlightedCandidate = isCandidate && !sourcePath && (!isHoveringAnyCandidate || isHovered);

  const semanticStyle = isSelected
    ? THEME_GLASS.SOURCE
    : isTarget
    ? THEME_GLASS.TARGET
    : isStatic
    ? THEME_GLASS.STATIC + ' select-none'
    : isHighlightedCandidate
    ? THEME_GLASS.CARD_CANDIDATE_SCAN
    : canClick
    ? THEME_GLASS.CARD_CANDIDATE
    : THEME_GLASS.CARD_CANDIDATE + ' cursor-default';

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return (
        <span className={`font-semibold ${isStatic ? 'text-zinc-500' : 'text-yellow-400/90'}`}>
          {constNode.value.toString()}
        </span>
      );
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      const displayMap: Record<string, string> = { pi: 'π', e: 'e' };
      const val = displayMap[symbolNode.name] || symbolNode.name;
      return (
        <span className={`italic font-serif ${isStatic ? 'text-zinc-500' : 'text-sky-300'} font-medium`}>
          {val}
        </span>
      );
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-center px-[0.1em]">
          <span className={`font-light text-[1.05em] select-none mr-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>(</span>
          <EquationNode path={`${path}/0`} key={getChildId(0)} />
          <span className={`font-light text-[1.05em] select-none ml-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>)</span>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className={`font-bold select-none ${isStatic ? 'text-zinc-600' : 'text-indigo-300/90'}`} style={getOpStyle()}>{opSymbol}</span>
            <EquationNode path={`${path}/0`} key={getChildId(0)} />
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className="flex flex-col items-center justify-center mx-[0.1em] my-[0.05em]">
            <div className="w-full text-center pb-[0.1em]">
              <EquationNode path={`${path}/0`} key={getChildId(0)} />
            </div>
            <div className="w-full border-t border-white/20 h-0" style={getOpStyle(true)} />
            <div className="w-full text-center pt-[0.1em]">
              <EquationNode path={`${path}/1`} key={getChildId(1)} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="flex items-start">
            <EquationNode path={`${path}/0`} key={getChildId(0)} />
            <div className="text-[0.65em] leading-none -mt-[0.2em] ml-[0.05em] scale-90 opacity-90">
              <EquationNode path={`${path}/1`} key={getChildId(1)} />
            </div>
          </div>
        );
      }

      // Normal binary operators (+, -, *)
      const opDisplayMap: Record<string, string> = {
        '+': '+',
        '-': '−',
        '*': '×',
      };
      const opSymbol = opDisplayMap[opNode.op] || opNode.op;

      return (
        <div className="flex items-center gap-[0.2em] flex-wrap justify-center py-[0.05em]">
          <EquationNode path={`${path}/0`} key={getChildId(0)} />
          <span className={`font-medium select-none text-[0.85em] ${isStatic ? 'text-zinc-600' : 'text-indigo-400'}`} style={getOpStyle()}>{opSymbol}</span>
          <EquationNode path={`${path}/1`} key={getChildId(1)} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em]">
            <span className={`text-[1.25em] font-light font-serif mr-[-0.05em] select-none self-center ${isStatic ? 'text-zinc-600' : 'text-indigo-300'}`} style={getOpStyle()}>√</span>
            <div className={`border-t border-l pt-[0.1em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? 'border-zinc-800' : 'border-white/30'}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className={`font-medium select-none text-[0.9em] ${isStatic ? 'text-zinc-500' : 'text-purple-300'}`} style={getOpStyle()}>{nameStr}</span>
          <span className={`mr-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>(</span>
          <EquationNode path={`${path}/0`} key={getChildId(0)} />
          <span className={`ml-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  const customStyle: React.CSSProperties = {
    maxWidth: '500px',
    transition: 'all 150ms ease-in-out',
  };

  return (
    <div
      data-flip-id={nodeId}
      style={customStyle}
      className={`relative inline-flex items-center justify-center p-[0.2em] border rounded-[0.4em] select-none ${semanticStyle}`}
      onMouseEnter={() => setHoverPath(path)}
      onMouseLeave={() => {
        const lastSlash = path.lastIndexOf('/');
        const parentPath = lastSlash !== -1 ? path.substring(0, lastSlash) : null;
        setHoverPath(parentPath);
      }}
      onClick={handleNodeClick}
    >
      {renderContent()}

      {/* Hover selection controls toolbar */}
      {isSelected && canToggleRoot(node) && (
        <div className="absolute -top-[2em] left-1/2 -translate-x-1/2 flex items-center gap-[0.1em] bg-neutral-900 border border-white/10 rounded-[1em] px-[0.6em] py-[0.2em] z-30 shadow-lg text-[0.55em] whitespace-nowrap">
          <Tooltip content="Toggle root sign (±)">
            <button
              onClick={handleToggleRootSign}
              className="p-[0.1em] hover:bg-white/10 text-indigo-400 hover:text-indigo-300 rounded-[1em] transition-colors flex items-center gap-[0.2em] cursor-pointer"
            >
              <Sparkles size={10} />
              <span>± Sign</span>
            </button>
          </Tooltip>
        </div>
      )}

      {/* Receptive target backing card transition layer */}
      {isTarget && (
        <div className="absolute -inset-0.5 bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse" />
      )}

      {/* Reduce Dot */}
      {isReducible && (
        <Tooltip
          content="Reduce this term"
          position="top"
          wrapperClassName="absolute -top-2 -right-2 z-20"
        >
          <button
            className={`h-5 w-5 rounded-full bg-amber-400 border border-amber-500/80 flex items-center justify-center cursor-pointer shadow-md hover:bg-amber-300 transition-colors relative group`}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoverReducePath(path);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setHoverReducePath(null);
            }}
            onClick={handleReduceClick}
          >
            {/* Subtle pulse effect inside the dot */}
            <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping group-hover:opacity-0 pointer-events-none" />
            <Zap size={10} className="text-neutral-950 fill-neutral-950 stroke-[2.5]" />
          </button>
        </Tooltip>
      )}
    </div>
  );
};
