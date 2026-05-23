'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { previewEquationAtom } from '../store/equation';
import { getNodeByPath, getFunctionName } from 'math-engine';

interface PreviewEquationNodeProps {
  readonly path: string;
}

export const PreviewEquationNode: React.FC<PreviewEquationNodeProps> = ({ path }) => {
  const previewEq = useAtomValue(previewEquationAtom);

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(previewEq, path);
    } catch {
      return null;
    }
  }, [previewEq, path]);

  if (!node) return null;

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return <span className="font-semibold text-yellow-500/80">{constNode.value.toString()}</span>;
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      const displayMap: Record<string, string> = { pi: 'π', e: 'e' };
      const val = displayMap[symbolNode.name] || symbolNode.name;
      return <span className="italic font-serif text-sky-400/80 font-medium">{val}</span>;
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-center px-1">
          <span className="text-white/20 font-light text-lg mr-0.5">(</span>
          <PreviewEquationNode path={`${path}/0`} />
          <span className="text-white/20 font-light text-lg ml-0.5">)</span>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-0.5">
            <span className="text-indigo-400/60 font-bold">{opSymbol}</span>
            <PreviewEquationNode path={`${path}/0`} />
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className="flex flex-col items-center justify-center mx-1 my-0.5">
            <div className="w-full text-center pb-1">
              <PreviewEquationNode path={`${path}/0`} />
            </div>
            <div className="w-full border-t border-white/10 h-0" />
            <div className="w-full text-center pt-1">
              <PreviewEquationNode path={`${path}/1`} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="flex items-start">
            <PreviewEquationNode path={`${path}/0`} />
            <div className="text-[10px] leading-none -mt-1 ml-0.5 scale-90 opacity-70">
              <PreviewEquationNode path={`${path}/1`} />
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
          <PreviewEquationNode path={`${path}/0`} />
          <span className="text-indigo-400/60 font-medium text-sm">{opSymbol}</span>
          <PreviewEquationNode path={`${path}/1`} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-1">
            <span className="text-2xl font-light font-serif mr-[-2px] text-indigo-400/60 self-center">√</span>
            <div className="border-t border-l border-white/15 pt-1 px-1.5 rounded-tr-md flex items-center">
              <PreviewEquationNode path={`${path}/0`} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-0.5">
          <span className="text-purple-400/60 font-medium">{nameStr}</span>
          <span className="text-white/20 mr-0.5">(</span>
          <PreviewEquationNode path={`${path}/0`} />
          <span className="text-white/20 ml-0.5">)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  return (
    <div className="relative inline-flex items-center justify-center p-1.5 border border-white/5 bg-white/0 rounded-lg">
      {renderContent()}
    </div>
  );
};
