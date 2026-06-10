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
  hoverReduceIndexAtom,
  reduciblePathsAtom,
  toggleRootSignAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { getNodeByPath, getFunctionName, getChildren, formatNumber } from 'math-engine-client';
import { ArrowLeftRight, Zap, Split, RefreshCw } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

const LeftParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 6,3 C 1,25 1,75 6,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

const RightParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 2,3 C 7,25 7,75 2,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

interface EquationNodeProps {
  readonly path: string;
  readonly inExponent?: boolean;
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

export const EquationNode: React.FC<EquationNodeProps> = ({ path, inExponent = false }) => {
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  const [hoverPath, setHoverPath] = useAtom(hoverPathAtom);
  const [hoverReducePath, setHoverReducePath] = useAtom(hoverReducePathAtom);
  const [hoverReduceIndex, setHoverReduceIndex] = useAtom(hoverReduceIndexAtom);
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

  const actions = reduciblePaths[path] || [];
  const isReducible = actions.length > 0;

  // Toggle Root Sign (+/- branches) via global action
  const handleToggleRootSign = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRootSign(path);
    trackEvent({
      action: 'toggle_root_sign',
      category: 'math_interaction',
      label: path,
    });
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
      trackEvent({
        action: 'apply_transposition',
        category: 'math_interaction',
        label: `${sourcePath} -> ${activeTargetPath}`,
      });
      return;
    }

    // Toggle select
    if (isSelected) {
      setSourcePath(null);
      trackEvent({
        action: 'deselect_node',
        category: 'math_interaction',
        label: path,
      });
    } else {
      setSourcePath(path);
      trackEvent({
        action: 'select_node',
        category: 'math_interaction',
        label: path,
      });
    }
  };

  // Styling hooks
  const canClick = sourcePath ? (isSelected || isTarget) : isCandidate;
  const canHover = sourcePath ? (isSelected || isTarget) : isCandidate;

  // Only dim candidate nodes if the user is actively hovering over *some* valid candidate.
  // Otherwise, if they hover static parts of the expression, keep all candidates bright (scan mode).
  const isHighlightedCandidate = isCandidate && !sourcePath && (!isHoveringAnyCandidate || isHovered);

  let semanticStyle = isSelected
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
          {formatNumber(constNode.value)}
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
        <div className="flex items-center px-[0.05em]">
          <LeftParenSVG className={`w-[0.32em] shrink-0 self-stretch ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()} />
          <div className="px-[0.05em]">
            <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          </div>
          <RightParenSVG className={`w-[0.32em] shrink-0 self-stretch ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()} />
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
            <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className={`flex flex-col items-center justify-center ${inExponent ? 'mx-[0.05em] my-[0.02em] text-[0.7em] leading-none' : 'mx-[0.1em] my-[0.05em]'}`}>
            <div className={`w-full text-center ${inExponent ? 'pb-[0.02em]' : 'pb-[0.1em]'}`}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
            <div className={`w-full border-t ${isStatic ? 'border-zinc-700/30' : 'border-white/20'} h-0`} style={getOpStyle(true)} />
            <div className={`w-full text-center ${inExponent ? 'pt-[0.02em]' : 'pt-[0.1em]'}`}>
              <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="inline-flex items-baseline relative" style={{ paddingTop: '0.8em' }}>
            <div>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
            <div className="relative" style={{ top: '-0.8em' }}>
              <div className="text-[0.65em] ml-[0.05em] opacity-90 scale-90" style={{ display: 'inline-block' }}>
                <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={true} />
              </div>
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
        <div className="flex items-center gap-[0.2em] flex-nowrap justify-center py-[0.05em]">
          <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          <span className={`font-medium select-none text-[0.85em] ${isStatic ? 'text-zinc-600' : 'text-indigo-400'}`} style={getOpStyle()}>{opSymbol}</span>
          <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'nthRoot') {
        let showIndex = funcNode.args.length > 1;
        if (showIndex) {
          let unwrapped = funcNode.args[1];
          while (unwrapped && unwrapped.type === 'ParenthesisNode') {
            unwrapped = (unwrapped as any).content;
          }
          if (unwrapped && unwrapped.type === 'ConstantNode' && ((unwrapped as any).value === 2 || (unwrapped as any).value === '2')) {
            showIndex = false;
          }
        }
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            <div className="flex items-stretch select-none shrink-0 relative mr-[-1px]">
              {showIndex && (
                <div className="absolute right-full top-0 -mt-[0.2em] -mr-[0.3em] text-[0.55em] scale-90 z-10" style={getOpStyle()}>
                  <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} />
                </div>
              )}
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`w-[0.7em] h-full ${isStatic ? 'text-zinc-600' : 'text-indigo-300'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={getOpStyle()}
              >
                <path
                  d="M 1,55 L 3.5,55 L 7.5,98 L 12,1"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? 'border-zinc-800' : 'border-white/30'}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            <div className="flex items-stretch select-none shrink-0 relative mr-[-1px]">
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`w-[0.7em] h-full ${isStatic ? 'text-zinc-600' : 'text-indigo-300'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={getOpStyle()}
              >
                <path
                  d="M 1,55 L 3.5,55 L 7.5,98 L 12,1"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? 'border-zinc-800' : 'border-white/30'}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className={`font-medium select-none text-[0.9em] ${isStatic ? 'text-zinc-500' : 'text-purple-300'}`} style={getOpStyle()}>{nameStr}</span>
          <span className={`mr-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>(</span>
          <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          <span className={`ml-[0.05em] ${isStatic ? 'text-zinc-600' : 'text-white/40'}`} style={getOpStyle()}>)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  const minWidth = isReducible 
    ? (inExponent 
        ? `${actions.length * 0.6 + (actions.length - 1) * 0.05 + 0.4}em`
        : `${actions.length * 15 + (actions.length - 1) * 3 + 8}px`)
    : undefined;

  const customStyle: React.CSSProperties = {
    transition: 'border-color 150ms, background-color 150ms, box-shadow 150ms, opacity 150ms',
    minWidth: minWidth,
  };

  const paddingClass = isReducible 
    ? (inExponent 
        ? 'pt-[1.0em] pb-[0.05em] px-[0.25em]' 
        : 'pt-[1.1rem] pb-[0.2em] px-[0.4em]') 
    : 'py-[0.2em] px-[0.35em]';

  return (
    <div
      data-flip-id={nodeId}
      style={customStyle}
      className={`relative inline-flex items-center justify-center border rounded-[0.4em] select-none ${semanticStyle} ${paddingClass}`}
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
              <RefreshCw size={10} />
              <span>± Sign</span>
            </button>
          </Tooltip>
        </div>
      )}

      {/* Receptive target backing card transition layer */}
      {isTarget && (
        <div className="absolute -inset-0.5 bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse" />
      )}

      {/* Compact Inline Operations Toolbar */}
      {isReducible && (
        <div className={`absolute flex items-center z-25 ${
          inExponent 
            ? 'top-[0.2em] right-[0.2em] gap-[0.05em]' 
            : 'top-1 right-1 gap-0.5'
        }`}>
          {actions.map((action, index) => {
            const type = action.type;
            const label = action.label || (type === 'distribute' ? "Distribute" : type === 'identity' ? "Apply Identity" : "Simplify");
            
            const isActionHovered = hoverReducePath === path && hoverReduceIndex === index;

            return (
              <Tooltip
                key={index}
                content={label}
                position="top"
              >
                <button
                  className={`flex items-center justify-center cursor-pointer shadow-md transition-all duration-150 relative group ${
                    type === 'distribute'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white animate-pulse'
                      : type === 'identity'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-inner'
                  } ${isActionHovered ? 'scale-110 ring-2 ring-white/50' : ''} ${
                    inExponent ? 'h-[0.6em] w-[0.6em] rounded-[0.15em]' : 'h-[15px] w-[15px] md:h-[14px] md:w-[14px] rounded-full'
                  }`}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoverReducePath(path);
                    setHoverReduceIndex(index);
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setHoverReducePath(null);
                    setHoverReduceIndex(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    pushEquation(action.equation, action.label || (action.type === 'distribute' ? 'Distribute' : action.type === 'identity' ? 'Apply Identity' : 'Simplify'));
                    trackEvent({
                      action: 'apply_reduction',
                      category: 'math_interaction',
                      label: `${action.type}: ${action.label || (action.type === 'distribute' ? 'Distribute' : 'Simplify')}`,
                    });
                    setHoverReducePath(null);
                    setHoverReduceIndex(null);
                  }}
                >
                  <span className={`absolute inset-0 animate-ping group-hover:opacity-0 pointer-events-none ${
                    type === 'distribute' 
                      ? 'bg-purple-500/40' 
                      : type === 'identity'
                      ? 'bg-indigo-500/40'
                      : 'bg-amber-400/40'
                  } ${
                    inExponent ? 'rounded-[0.15em]' : 'rounded-full'
                  }`} />
                  {type === 'distribute' ? (
                    <Split size={inExponent ? 5 : 7.5} className="text-white stroke-[2.5]" />
                  ) : type === 'identity' ? (
                    <ArrowLeftRight size={inExponent ? 5 : 7.5} className="text-white stroke-[2.5]" />
                  ) : (
                    <Zap size={inExponent ? 5 : 7.5} className="text-neutral-950 fill-neutral-950 stroke-[2.5]" />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
};
