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
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { getNodeByPath, replaceNodeAtPath, getFunctionName, equationToString } from 'math-engine';
import { ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

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

  // Selection depth adjustments
  const handleExpandSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts = path.split('/');
    if (parts.length > 1) {
      setSelectedPath(parts.slice(0, -1).join('/'));
    }
  };

  const handleShrinkSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPath(`${path}/0`);
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
    ? THEME_GLASS.GLOW_ACTIVE
    : isValidDrop
    ? THEME_GLASS.GLOW_VALID + ' animate-pulse border-emerald-400 bg-emerald-500/10 cursor-pointer'
    : isHovered
    ? 'border-indigo-400/40 bg-white/10'
    : 'border-white/10';

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
        <div className="flex items-center px-1">
          <span className="text-white/40 font-light text-lg select-none mr-0.5">(</span>
          <EquationNode path={`${path}/0`} />
          <span className="text-white/40 font-light text-lg select-none ml-0.5">)</span>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-0.5">
            <span className="text-indigo-300/90 font-bold select-none">{opSymbol}</span>
            <EquationNode path={`${path}/0`} />
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className="flex flex-col items-center justify-center mx-1 my-0.5">
            <div className="w-full text-center pb-1">
              <EquationNode path={`${path}/0`} />
            </div>
            <div className="w-full border-t border-white/20 h-0" />
            <div className="w-full text-center pt-1">
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
            <div className="text-[10px] leading-none -mt-1 ml-0.5 scale-90 opacity-90">
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
        <div className="flex items-center gap-1.5 flex-wrap justify-center py-1">
          <EquationNode path={`${path}/0`} />
          <span className="text-indigo-400 font-medium select-none text-sm">{opSymbol}</span>
          <EquationNode path={`${path}/1`} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-1">
            <span className="text-2xl font-light font-serif mr-[-2px] select-none text-indigo-300 self-center">√</span>
            <div className="border-t border-l border-white/30 pt-1 px-1.5 rounded-tr-md flex items-center">
              <EquationNode path={`${path}/0`} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-0.5">
          <span className="text-purple-300 font-medium select-none">{nameStr}</span>
          <span className="text-white/40 mr-0.5">(</span>
          <EquationNode path={`${path}/0`} />
          <span className="text-white/40 ml-0.5">)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center p-1.5 border rounded-lg ${borderStyle} ${THEME_TRANSITIONS.FAST}`}
      onMouseEnter={() => setHoverPath(path)}
      onMouseLeave={() => setHoverPath(null)}
      onClick={handleNodeClick}
    >
      {renderContent()}

      {/* Hover selection controls toolbar */}
      {isSelected && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 border border-white/10 rounded-full px-2 py-0.5 z-30 shadow-lg text-[10px]">
          {path.split('/').length > 1 && (
            <button
              onClick={handleExpandSelection}
              className="p-1 hover:bg-white/10 text-white rounded-full transition-colors flex items-center gap-0.5"
              title="Expand selection (Select parent terms)"
            >
              <ArrowUp size={10} />
              <span>Expand</span>
            </button>
          )}
          {node.type !== 'ConstantNode' && node.type !== 'SymbolNode' && (
            <button
              onClick={handleShrinkSelection}
              className="p-1 hover:bg-white/10 text-white rounded-full transition-colors flex items-center gap-0.5"
              title="Shrink selection (Select inner terms)"
            >
              <ArrowDown size={10} />
              <span>Shrink</span>
            </button>
          )}
          {canToggleRoot(node) && (
            <button
              onClick={handleToggleRootSign}
              className="p-1 hover:bg-white/10 text-indigo-400 hover:text-indigo-300 rounded-full transition-colors flex items-center gap-0.5"
              title="Toggle root branch (+/- sign)"
            >
              <Sparkles size={10} />
              <span>± Sign</span>
            </button>
          )}
        </div>
      )}

      {/* Glowing placeholder icon for valid drops */}
      {isValidDrop && (
        <div className="absolute -inset-0.5 bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse" />
      )}

      {/* Floating speculative equation tooltip on hover */}
      {isValidDrop && isHovered && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-neutral-950/95 border border-indigo-500/35 rounded-xl px-3 py-1.5 shadow-2xl z-40 text-[10px] font-mono whitespace-nowrap animate-[pulse_2s_infinite]">
          <span className="text-white/40 mr-1 select-none">Result:</span>
          <span className="text-indigo-200 font-semibold tracking-wide">
            {equationToString(validDrops[path])}
          </span>
        </div>
      )}
    </div>
  );
};
