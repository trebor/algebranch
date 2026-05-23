'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import * as math from 'mathjs';
import {
  selectedPathAtom,
  hoverPathAtom,
  validDropPathsAtom,
  pushEquationAtom,
  currentEquationAtom,
  pathsWithValidMovesAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { getNodeByPath, replaceNodeAtPath, getFunctionName, equationToString } from 'math-engine';
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
  const [selectedPath, setSelectedPath] = useAtom(selectedPathAtom);
  const [hoverPath, setHoverPath] = useAtom(hoverPathAtom);
  const validDrops = useAtomValue(validDropPathsAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const pathsWithValidMoves = useAtomValue(pathsWithValidMovesAtom);

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(currentEq, path);
    } catch {
      return null;
    }
  }, [currentEq, path]);

  if (!node) return null;

  const isSelected = selectedPath === path;
  const isHovered = hoverPath === path;
  const isValidDrop = path in validDrops;
  const hasValidMoves = pathsWithValidMoves.has(path);
  const isGreyedOut = !selectedPath && !hasValidMoves;

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

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isValidDrop) {
      // Complete move!
      pushEquation(validDrops[path]);
      return;
    }

    // Toggle select
    if (isSelected) {
      setSelectedPath(null);
    } else {
      setSelectedPath(path);
    }
  };

  // Styling hooks
  const borderStyle = isSelected
    ? THEME_GLASS.GLOW_ACTIVE + ' bg-indigo-950/80 text-indigo-100 font-semibold'
    : isValidDrop
    ? THEME_GLASS.GLOW_VALID + ' border-emerald-400 bg-emerald-950/80 cursor-pointer text-emerald-100 animate-pulse font-semibold'
    : isGreyedOut
    ? 'border-white/5 bg-transparent opacity-25 pointer-events-none select-none'
    : isHovered
    ? 'border-indigo-400/40 bg-neutral-900/90 text-white font-medium shadow-md shadow-indigo-500/5'
    : 'border-white/10 bg-neutral-950/90 text-white/90';

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    const valExponent = 2;

    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return <span className="font-semibold text-yellow-400/90">{constNode.value.toString()}</span>;
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      const displayMap: Record<string, string> = { pi: 'π', e: 'e' };
      const val = displayMap[symbolNode.name] || symbolNode.name;
      return <span className="italic font-serif text-sky-300 font-medium">{val}</span>;
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-center px-[0.1em]">
          <span className="text-white/40 font-light text-[1.05em] select-none mr-[0.05em]">(</span>
          <EquationNode path={`${path}/0`} />
          <span className="text-white/40 font-light text-[1.05em] select-none ml-[0.05em]">)</span>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className="text-indigo-300/90 font-bold select-none">{opSymbol}</span>
            <EquationNode path={`${path}/0`} />
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className="flex flex-col items-center justify-center mx-[0.1em] my-[0.05em]">
            <div className="w-full text-center pb-[0.1em]">
              <EquationNode path={`${path}/0`} />
            </div>
            <div className="w-full border-t border-white/20 h-0" />
            <div className="w-full text-center pt-[0.1em]">
              <EquationNode path={`${path}/1`} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="flex items-start">
            <EquationNode path={`${path}/0`} />
            <div className="text-[0.65em] leading-none -mt-[0.2em] ml-[0.05em] scale-90 opacity-90">
              <EquationNode path={`${path}/1`} />
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
          <EquationNode path={`${path}/0`} />
          <span className="text-indigo-400 font-medium select-none text-[0.85em]">{opSymbol}</span>
          <EquationNode path={`${path}/1`} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em]">
            <span className="text-[1.25em] font-light font-serif mr-[-0.05em] select-none text-indigo-300 self-center">√</span>
            <div className="border-t border-l border-white/30 pt-[0.1em] px-[0.15em] rounded-tr-[0.2em] flex items-center">
              <EquationNode path={`${path}/0`} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className="text-purple-300 font-medium select-none text-[0.9em]">{nameStr}</span>
          <span className="text-white/40 mr-[0.05em]">(</span>
          <EquationNode path={`${path}/0`} />
          <span className="text-white/40 ml-[0.05em]">)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center p-[0.2em] border rounded-[0.4em] ${borderStyle} ${THEME_TRANSITIONS.FAST}`}
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

      {/* Glowing placeholder icon for valid drops */}
      {isValidDrop && (
        <div className="absolute -inset-0.5 bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse" />
      )}
    </div>
  );
};
