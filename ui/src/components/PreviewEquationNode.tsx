'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { previewEquationAtom } from '../store/equation';
import { getNodeByPath, getFunctionName, getChildren } from 'math-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME_ANIMATIONS } from '../constants/theme';

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

  const getChildId = (index: number): string => {
    try {
      const children = getChildren(node);
      if (children && children[index]) {
        return (children[index] as any).id || `${path}/${index}`;
      }
    } catch {}
    return `${path}/${index}`;
  };

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
        <div className="flex items-center px-[0.1em]">
          <span className="text-white/20 font-light text-[1.05em] mr-[0.05em] select-none">(</span>
          <AnimatePresence mode="popLayout">
            <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
          </AnimatePresence>
          <span className="text-white/20 font-light text-[1.05em] ml-[0.05em] select-none">)</span>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className="text-indigo-400/60 font-bold select-none">{opSymbol}</span>
            <AnimatePresence mode="popLayout">
              <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
            </AnimatePresence>
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className="flex flex-col items-center justify-center mx-[0.1em] my-[0.05em]">
            <div className="w-full text-center pb-[0.1em]">
              <AnimatePresence mode="popLayout">
                <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
              </AnimatePresence>
            </div>
            <div className="w-full border-t border-white/10 h-0" />
            <div className="w-full text-center pt-[0.1em]">
              <AnimatePresence mode="popLayout">
                <PreviewEquationNode path={`${path}/1`} key={getChildId(1)} />
              </AnimatePresence>
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="flex items-start">
            <AnimatePresence mode="popLayout">
              <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
            </AnimatePresence>
            <div className="text-[0.65em] leading-none -mt-[0.2em] ml-[0.05em] scale-90 opacity-70">
              <AnimatePresence mode="popLayout">
                <PreviewEquationNode path={`${path}/1`} key={getChildId(1)} />
              </AnimatePresence>
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
          <AnimatePresence mode="popLayout">
            <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
          </AnimatePresence>
          <span className="text-indigo-400/60 font-medium text-[0.85em] select-none">{opSymbol}</span>
          <AnimatePresence mode="popLayout">
            <PreviewEquationNode path={`${path}/1`} key={getChildId(1)} />
          </AnimatePresence>
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em]">
            <span className="text-[1.25em] font-light font-serif mr-[-0.05em] text-indigo-400/60 self-center select-none">√</span>
            <div className="border-t border-l border-white/15 pt-[0.1em] px-[0.15em] rounded-tr-[0.2em] flex items-center">
              <AnimatePresence mode="popLayout">
                <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
              </AnimatePresence>
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className="text-purple-400/60 font-medium text-[0.9em]">{nameStr}</span>
          <span className="text-white/20 mr-[0.05em]">(</span>
          <AnimatePresence mode="popLayout">
            <PreviewEquationNode path={`${path}/0`} key={getChildId(0)} />
          </AnimatePresence>
          <span className="text-white/20 ml-[0.05em]">)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={THEME_ANIMATIONS.LAYOUT_TRANSITION}
      className="relative inline-flex items-center justify-center p-[0.2em] border border-white/5 bg-white/0 rounded-[0.4em]"
    >
      {renderContent()}
    </motion.div>
  );
};
