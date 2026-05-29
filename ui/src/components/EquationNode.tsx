'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import * as math from 'mathjs';
import {
  sourcePathAtom,
  hoverPathAtom,
  targetPathsAtom,
  pushEquationAtom,
  currentEquationAtom,
  activePathsAtom,
  hoverReducePathAtom,
  reduciblePathsAtom,
  animatingExitPathAtom,
  animatingEntryIdAtom,
  flightStateAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS, THEME_ANIMATIONS } from '../constants/theme';
import { getNodeByPath, replaceNodeAtPath, getFunctionName, getChildren } from 'math-engine';
import { Sparkles } from 'lucide-react';

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
  const activePaths = useAtomValue(activePathsAtom);
  const [animatingExitPath, setAnimatingExitPath] = useAtom(animatingExitPathAtom);
  const [animatingEntryId, setAnimatingEntryId] = useAtom(animatingEntryIdAtom);
  const setFlightState = useSetAtom(flightStateAtom);

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(currentEq, path);
    } catch {
      return null;
    }
  }, [currentEq, path]);

  const nodeId = node ? (node as unknown as { id?: string }).id || '' : '';

  // 1. Detect if any direct child is currently entry-animating
  const isOperatorEntryAnimating = React.useMemo(() => {
    if (!node || !animatingEntryId) {
      return false;
    }
    try {
      const children = getChildren(node);
      return children.some((child) => {
        if (!child) return false;
        const childId = (child as unknown as { id?: string }).id;
        return childId === animatingEntryId;
      });
    } catch {
      return false;
    }
  }, [node, animatingEntryId]);

  // 2. Detect if any direct child is currently exit-animating
  const isOperatorExitAnimating = React.useMemo(() => {
    if (!animatingExitPath) {
      return false;
    }
    return animatingExitPath === `${path}/0` || animatingExitPath === `${path}/1`;
  }, [path, animatingExitPath]);

  // Local state to keep the entering node scaled down to 0 instantly on initial render
  const [isScaledDown, setIsScaledDown] = React.useState(!!(nodeId && nodeId === animatingEntryId));
  const [isOpScaledDown, setIsOpScaledDown] = React.useState(isOperatorEntryAnimating);

  React.useEffect(() => {
    if (nodeId && nodeId === animatingEntryId) {
      // 1. Force initial zero-scale mount before triggering transition
      const triggerTimer = setTimeout(() => {
        setIsScaledDown(false);
      }, 50);

      // 2. Clear global entry lock and reset atom once transition completes
      const clearTimer = setTimeout(() => {
        setAnimatingEntryId(null);
      }, THEME_ANIMATIONS.TRANSITION_DURATION_MS + 100);

      return () => {
        clearTimeout(triggerTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [nodeId, animatingEntryId, setAnimatingEntryId]);

  React.useEffect(() => {
    if (isOperatorEntryAnimating) {
      const timer = setTimeout(() => {
        setIsOpScaledDown(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOperatorEntryAnimating]);

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

    if (isOperatorExitAnimating) {
      return {
        ...displayStyle,
        transform: 'scale(0)',
        opacity: 0,
        maxWidth: '0px',
        paddingLeft: 0,
        paddingRight: 0,
        marginLeft: 0,
        marginRight: 0,
        overflow: 'hidden',
        transition: `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, opacity ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, max-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, padding ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, margin ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out`,
      };
    }
    if (isOpScaledDown) {
      return {
        ...displayStyle,
        transform: 'scale(0)',
        opacity: 0,
        maxWidth: '0px',
        paddingLeft: 0,
        paddingRight: 0,
        marginLeft: 0,
        marginRight: 0,
        overflow: 'hidden',
      };
    }
    if (isOperatorEntryAnimating) {
      return {
        ...displayStyle,
        transform: 'scale(1)',
        opacity: 1,
        maxWidth: '100px', // safe upper bound for operator symbols
        overflow: 'hidden',
        transition: `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, opacity ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, max-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out`,
      };
    }
    return {
      ...displayStyle,
      maxWidth: '200px', // Explicit starting max-width for smooth exit transition!
      transition: 'all 150ms ease-in-out',
    };
  };

  const isSelected = sourcePath === path;
  const isHovered = hoverPath === path || (hoverPath !== null && hoverPath.startsWith(`${path}/`));
  const isTarget = !!sourcePath && path in targetPaths;
  const isActive = activePaths.has(path);
  const isStatic = sourcePath
    ? (!isSelected && !isTarget)
    : !isActive;

  const reducedEq = reduciblePaths[path];
  const isReducible = !!reducedEq;

  const handleReduceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reducedEq) {
      pushEquation(reducedEq);
      setHoverReducePath(null);
    }
  };

  // Toggle Root Sign (Positive/Negative branches)
  const handleToggleRootSign = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const targetNode = getNodeByPath(currentEq, path);
      let nextNode: math.MathNode;

      if (
        targetNode.type === 'OperatorNode' &&
        (targetNode as math.OperatorNode).op === '-' &&
        (targetNode as math.OperatorNode).isUnary()
      ) {
        // Toggle negative root to positive: -sqrt(x) -> sqrt(x)
        nextNode = (targetNode as math.OperatorNode).args[0];
      } else {
        // Toggle positive root to negative: sqrt(x) -> -sqrt(x)
        nextNode = new math.OperatorNode('-', 'subtract', [targetNode]);
      }

      const nextEq = replaceNodeAtPath(currentEq, path, nextNode);
      pushEquation(nextEq);
    } catch (err) {
      console.error('Failed to toggle root sign:', err);
    }
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
      // Static nodes do not interact and block click propagation to parent elements
      return;
    }

    const activeTargetPath = getTargetPath();
    if (activeTargetPath && sourcePath) {
      // Fetch the unique ID of the moving node
      const movingNode = getNodeByPath(currentEq, sourcePath);
      const movingId = movingNode ? (movingNode as unknown as { id?: string }).id : null;

      // Capture and measure DOM elements for the Bezier Hybrid Flight
      if (movingId) {
        const sourceEl = document.querySelector(`[data-flip-id="${movingId}"]`) as HTMLElement;
        const targetNode = getNodeByPath(currentEq, activeTargetPath);
        const targetId = targetNode ? (targetNode as unknown as { id?: string }).id : null;
        const targetEl = targetId ? (document.querySelector(`[data-flip-id="${targetId}"]`) as HTMLElement) : null;

        if (sourceEl && targetEl) {
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          const startX = sourceRect.left + window.scrollX;
          const startY = sourceRect.top + window.scrollY;

          // Target is centered inside the receptive target container card
          const endX = targetRect.left + window.scrollX + (targetRect.width / 2) - (sourceRect.width / 2);
          const endY = targetRect.top + window.scrollY + (targetRect.height / 2) - (sourceRect.height / 2);

          setFlightState({
            id: movingId,
            html: sourceEl.innerHTML,
            className: sourceEl.className,
            startX,
            startY,
            endX,
            endY,
            width: sourceRect.width,
            height: sourceRect.height,
          });
        }
      }

      // Trigger the exit transition on the selected node
      setAnimatingExitPath(sourcePath);

      // Defer pushing the new equation until after the animation duration
      setTimeout(() => {
        if (movingId) {
          setAnimatingEntryId(movingId);
        }
        pushEquation(targetPaths[activeTargetPath]);
        setAnimatingExitPath(null);
        setFlightState(null); // Clear flight animation upon arrival!
      }, THEME_ANIMATIONS.TRANSITION_DURATION_MS);
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
  const canClick = sourcePath ? (isSelected || isTarget) : isActive;
  const canHover = sourcePath ? (isSelected || isTarget) : isActive;

  const semanticStyle = isSelected
    ? THEME_GLASS.SOURCE
    : isTarget
    ? THEME_GLASS.TARGET
    : isStatic
    ? THEME_GLASS.STATIC + ' select-none'
    : (isHovered && canHover)
    ? THEME_GLASS.CARD_HOVER
    : canClick
    ? THEME_GLASS.CARD_ACTIVE
    : THEME_GLASS.CARD_ACTIVE + ' cursor-default';

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

  // Block clicks globally during active exit or entry transitions
  const isGlobalAnimating = animatingExitPath !== null || animatingEntryId !== null;
  const shouldBlockEvents = isGlobalAnimating;

  // Transition styling logic
  const isAnimatingExit = animatingExitPath === path;
  let customStyle: React.CSSProperties = {
    maxWidth: '500px', // Explicit starting max-width for smooth exit transition!
    transition: 'all 150ms ease-in-out',
  };

  if (isAnimatingExit) {
    customStyle = {
      transform: 'scale(0)',
      opacity: 0,
      maxWidth: '0px',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      borderWidth: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      transition: `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, opacity ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, max-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, padding ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, margin ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, border-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out`,
    };
  } else if (isScaledDown) {
    customStyle = {
      transform: 'scale(0)',
      opacity: 0,
      maxWidth: '0px',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      borderWidth: 0,
      overflow: 'hidden',
    };
  } else if (nodeId && nodeId === animatingEntryId) {
    customStyle = {
      transform: 'scale(1)',
      opacity: 1,
      maxWidth: '300px', // safe upper bound
      paddingLeft: '0.2em', // standard tailwind padding
      paddingRight: '0.2em',
      paddingTop: '0.2em',
      paddingBottom: '0.2em',
      borderWidth: '1px',
      overflow: 'hidden',
      pointerEvents: 'none',
      transition: `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, opacity ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, max-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, padding ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out, border-width ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms ease-in-out`,
    };
  }

  return (
    <div
      data-flip-id={nodeId}
      style={customStyle}
      className={`relative inline-flex items-center justify-center p-[0.2em] border rounded-[0.4em] select-none ${semanticStyle} ${shouldBlockEvents ? 'pointer-events-none' : ''}`}
      onMouseEnter={() => setHoverPath(path)}
      onMouseLeave={() => setHoverPath(null)}
      onClick={handleNodeClick}
    >
      {renderContent()}

      {/* Hover selection controls toolbar */}
      {isSelected && canToggleRoot(node) && (
        <div className="absolute -top-[2em] left-1/2 -translate-x-1/2 flex items-center gap-[0.1em] bg-neutral-900 border border-white/10 rounded-[1em] px-[0.6em] py-[0.2em] z-30 shadow-lg text-[0.55em] whitespace-nowrap">
          <button
            onClick={handleToggleRootSign}
            className="p-[0.1em] hover:bg-white/10 text-indigo-400 hover:text-indigo-300 rounded-[1em] transition-colors flex items-center gap-[0.2em] cursor-pointer"
            title="Toggle root branch (+/- sign)"
          >
            <Sparkles size={10} />
            <span>± Sign</span>
          </button>
        </div>
      )}

      {/* Receptive target backing card transition layer */}
      {isTarget && (
        <div className="absolute -inset-0.5 bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse" />
      )}

      {/* Reduce Dot */}
      {isReducible && (
        <button
          className={`absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-amber-400 border border-neutral-950 flex items-center justify-center cursor-pointer shadow-md hover:bg-amber-300 transition-colors z-20 group ${THEME_TRANSITIONS.FAST}`}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoverReducePath(path);
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            setHoverReducePath(null);
          }}
          onClick={handleReduceClick}
          title="Reduce this term"
        >
          {/* Subtle pulse effect inside the dot */}
          <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping group-hover:opacity-0 pointer-events-none" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-950 pointer-events-none" />
        </button>
      )}
    </div>
  );
};
