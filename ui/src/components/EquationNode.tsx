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
  onboardingChapterIdAtom,
  onboardingHighlightPathAtom,
  onboardingTargetPathAtom,
  onboardingReduceHandleAtom,
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

/**
 * Layout design tokens (in relative em units) used to calculate node dimensions dynamically.
 */
const MATH_LAYOUT = {
  // Normal layouts
  normal: {
    btnSize: 0.8,
    btnGap: 0.05,
    btnTop: 0.08,
    btnRight: 0.15,
    nodePx: 0.35,
    nodePy: 0.18,
    textGap: 0.07,
  },
  // Exponent layouts
  exponent: {
    btnSize: 0.55,
    btnGap: 0.05,
    btnTop: 0.05,
    btnRight: 0.1,
    nodePx: 0.2,
    nodePy: 0.12,
    textGap: 0.05,
  }
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
  const isOnboardingActive = !!useAtomValue(onboardingChapterIdAtom);
  const onboardingHighlightPath = useAtomValue(onboardingHighlightPathAtom);
  const onboardingTargetPath = useAtomValue(onboardingTargetPathAtom);
  const onboardingReduceHandle = useAtomValue(onboardingReduceHandleAtom);
  // The circle marks the reduce handle itself when one produces the step's expected
  // equation; otherwise it marks the node box (selection/transposition steps).
  const isHandleMarked = isOnboardingActive && onboardingReduceHandle?.path === path;
  // The "click here" circle yields once its node is selected as Source — from
  // there the Source styling acknowledges the click and the target circle
  // takes over guiding the next one.
  const isOnboardingMarked = !isHandleMarked &&
    ((path === onboardingHighlightPath && sourcePath !== path) ||
      (isOnboardingActive && path === onboardingTargetPath));

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

  // During the tour, only the specific handle the tutorial wants clicked is
  // offered (the one whose result matches the step's expected equation);
  // every other handle is locked out like the rest of the UI.
  const allActions = reduciblePaths[path] || [];
  const actions = !isOnboardingActive
    ? allActions
    : isHandleMarked && onboardingReduceHandle && allActions[onboardingReduceHandle.index]
      ? [allActions[onboardingReduceHandle.index]]
      : [];
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
    if (isStatic) {
      return;
    }

    if (isOnboardingActive) {
      if (sourcePath) {
        if (!isSelected) {
          const activeTargetPath = getTargetPath();
          if (!activeTargetPath) return;
        }
      } else {
        // Steps that expect a handle click lock out node selection entirely —
        // only the handle button (which stops propagation itself) is live.
        if (onboardingReduceHandle) return;
        if (path !== onboardingHighlightPath) return;
      }
    }

    e.stopPropagation();

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
    ? ((isReducible && !sourcePath) 
        ? THEME_GLASS.CARD_CANDIDATE_SCAN.replace('cursor-pointer', 'cursor-default') + ' select-none' 
        : THEME_GLASS.STATIC + ' select-none')
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
        <span className={`font-semibold ${isStatic ? THEME_GLASS.MATH_NUMBER_STATIC : THEME_GLASS.MATH_NUMBER_ACTIVE}`}>
          {formatNumber(constNode.value)}
        </span>
      );
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      const displayMap: Record<string, string> = { pi: 'π', e: 'e' };
      const val = displayMap[symbolNode.name] || symbolNode.name;
      return (
        <span className={`italic font-serif ${isStatic ? THEME_GLASS.MATH_VAR_STATIC : THEME_GLASS.MATH_VAR_ACTIVE} font-medium`}>
          {val}
        </span>
      );
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-center px-[0.05em]">
          <LeftParenSVG className={`w-[0.32em] shrink-0 self-stretch ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()} />
          <div className="px-[0.05em]">
            <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          </div>
          <RightParenSVG className={`w-[0.32em] shrink-0 self-stretch ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()} />
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className={`font-bold select-none ${isStatic ? THEME_GLASS.MATH_OP_STATIC : THEME_GLASS.MATH_OP_UNARY_ACTIVE}`} style={getOpStyle()}>{opSymbol}</span>
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
            <div className={`w-full border-t ${isStatic ? THEME_GLASS.MATH_BORDER_STATIC : THEME_GLASS.MATH_BORDER_ACTIVE} h-0`} style={getOpStyle(true)} />
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
          <span className={`font-medium select-none text-[0.85em] ${isStatic ? THEME_GLASS.MATH_OP_STATIC : THEME_GLASS.MATH_OP_ACTIVE}`} style={getOpStyle()}>{opSymbol}</span>
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
                className={`w-[0.7em] h-full ${isStatic ? THEME_GLASS.MATH_FN_ROOT_STATIC : THEME_GLASS.MATH_FN_ROOT_ACTIVE}`}
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
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? THEME_GLASS.MATH_BORDER_FN_STATIC : THEME_GLASS.MATH_BORDER_FN_ACTIVE}`} style={getOpStyle(true)}>
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
                className={`w-[0.7em] h-full ${isStatic ? THEME_GLASS.MATH_FN_ROOT_STATIC : THEME_GLASS.MATH_FN_ROOT_ACTIVE}`}
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
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? THEME_GLASS.MATH_BORDER_FN_STATIC : THEME_GLASS.MATH_BORDER_FN_ACTIVE}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className={`font-medium select-none text-[0.9em] ${isStatic ? THEME_GLASS.MATH_FN_STATIC : THEME_GLASS.MATH_FN_ACTIVE}`} style={getOpStyle()}>{nameStr}</span>
          <span className={`mr-[0.05em] ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()}>(</span>
          <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          <span className={`ml-[0.05em] ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()}>)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  const layout = inExponent ? MATH_LAYOUT.exponent : MATH_LAYOUT.normal;

  const minWidth = isReducible 
    ? `${actions.length * layout.btnSize + (actions.length - 1) * layout.btnGap + layout.nodePx * 2}em`
    : undefined;

  const paddingTop = isReducible 
    ? layout.btnTop + layout.btnSize + layout.textGap 
    : layout.nodePy;

  const customStyle: React.CSSProperties = {
    transition: 'border-color 150ms, background-color 150ms, box-shadow 150ms, opacity 150ms',
    minWidth: minWidth,
    paddingLeft: `${layout.nodePx}em`,
    paddingRight: `${layout.nodePx}em`,
    paddingTop: `${paddingTop}em`,
    paddingBottom: `${layout.nodePy}em`,
  };

  return (
    <div
      data-flip-id={nodeId}
      style={customStyle}
      className={`relative inline-flex items-center justify-center border rounded-[0.4em] select-none ${semanticStyle}`}
      onMouseEnter={() => {
        setHoverPath(path);
      }}
      onMouseLeave={() => {
        const lastSlash = path.lastIndexOf('/');
        const parentPath = lastSlash !== -1 ? path.substring(0, lastSlash) : null;
        setHoverPath(parentPath);
      }}
      onClick={handleNodeClick}
    >
      {renderContent()}

      {/* Onboarding annotation circle: a bright white loop overshooting the node box,
          deliberately outside the app's rounded-rect + hue vocabulary. Rendered as a
          child so it tracks FLIP moves, scaling, and reflows for free. */}
      {isOnboardingMarked && (
        <span aria-hidden="true" className={`-inset-[0.4em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
      )}

      {/* Hover selection controls toolbar */}
      {isSelected && canToggleRoot(node) && (
        <div className={`absolute -top-[2em] left-1/2 -translate-x-1/2 flex items-center gap-[0.1em] z-30 ${THEME_GLASS.MINI_TOOLBAR}`}>
          <Tooltip content="Toggle root sign (±)">
            <button
              onClick={handleToggleRootSign}
              className={THEME_GLASS.MINI_TOOLBAR_BUTTON}
            >
              <RefreshCw size={10} />
              <span>± Sign</span>
            </button>
          </Tooltip>
        </div>
      )}

      {/* Receptive target backing card transition layer */}
      {isTarget && (
        <div className={THEME_GLASS.TARGET_GLOW} />
      )}

      {/* Compact Inline Operations Toolbar - sits inside the top-padding area to prevent layout overlap */}
      {isReducible && (
        <div 
          className="absolute flex items-center z-25"
          style={{
            top: `${layout.btnTop}em`,
            right: `${layout.btnRight}em`,
            gap: `${layout.btnGap}em`,
          }}
        >
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
                      ? THEME_GLASS.HANDLE_DISTRIBUTE
                      : type === 'identity'
                      ? THEME_GLASS.HANDLE_IDENTITY
                      : THEME_GLASS.HANDLE_SIMPLIFY
                  } ${isActionHovered ? 'scale-110 ring-2 ring-white/50' : ''}`}
                  style={{
                    width: `${layout.btnSize}em`,
                    height: `${layout.btnSize}em`,
                    borderRadius: inExponent ? '0.12em' : '9999px',
                  }}
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
                  <span 
                    className={`absolute inset-0 animate-ping group-hover:opacity-0 pointer-events-none ${
                      type === 'distribute' 
                        ? THEME_GLASS.PING_DISTRIBUTE 
                        : type === 'identity'
                        ? THEME_GLASS.PING_IDENTITY
                        : THEME_GLASS.PING_SIMPLIFY
                    }`}
                    style={{
                      borderRadius: inExponent ? '0.12em' : '9999px',
                    }}
                  />
                  {isHandleMarked && (
                    <span aria-hidden="true" className={`-inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                  )}
                  {type === 'distribute' ? (
                    <Split className="h-[65%] w-[65%] text-white stroke-[2.5]" />
                  ) : type === 'identity' ? (
                    <ArrowLeftRight className="h-[65%] w-[65%] text-white stroke-[2.5]" />
                  ) : (
                    <Zap className="h-[65%] w-[65%] text-neutral-950 fill-neutral-950 stroke-[2.5]" />
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
