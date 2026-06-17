// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { currentEquationAtom } from '../store/equation';
import { Equation, getNodeByPath, getFunctionName, formatNumber } from 'math-engine-client';
import { OPERATOR_DISPLAY, symbolToGlyph } from '../constants/mathSymbols';

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

interface PreviewEquationNodeProps {
  readonly path: string;
  readonly inExponent?: boolean;
  readonly customEquation?: Equation;
}

export const PreviewEquationNode: React.FC<PreviewEquationNodeProps> = ({
  path,
  inExponent = false,
  customEquation,
}) => {
  const currentEq = useAtomValue(currentEquationAtom);
  const eq = customEquation ?? currentEq;

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(eq, path);
    } catch {
      return null;
    }
  }, [eq, path]);

  if (!node) return null;

  const nodeId = (node as unknown as { id?: string })?.id || `preview_${path}`;

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return <span className="font-semibold text-yellow-500/80">{formatNumber(constNode.value)}</span>;
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      const val = symbolToGlyph(symbolNode.name);
      return <span className="italic font-serif text-sky-400/80 font-medium">{val}</span>;
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-stretch px-[0.05em] relative">
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: '0.2em',
                bottom: '0.2em'
              }}
            >
              <LeftParenSVG className="w-full h-full text-white/20" />
            </div>
          </div>
          <div className="px-[0.05em]">
            <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
          </div>
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: '0.2em',
                bottom: '0.2em'
              }}
            >
              <RightParenSVG className="w-full h-full text-white/20" />
            </div>
          </div>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        // Parenthesize a unary-minus operand of a unary minus so it reads "−(−3)"
        // rather than the ambiguous "−−3" (mirrors EquationNode and equationToString).
        const child = opNode.args[0];
        const childNeedsParens =
          opNode.op === '-' &&
          child.type === 'OperatorNode' &&
          (child as math.OperatorNode).isUnary() &&
          (child as math.OperatorNode).op === '-';
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className="text-indigo-400/60 font-bold select-none">{opSymbol}</span>
            {childNeedsParens ? (
              <div className="flex items-stretch px-[0.05em] relative">
                <div className="relative w-[0.32em] select-none shrink-0">
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: '0.2em',
                      bottom: '0.2em'
                    }}
                  >
                    <LeftParenSVG className="w-full h-full text-white/20" />
                  </div>
                </div>
                <div className="px-[0.05em]">
                  <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
                </div>
                <div className="relative w-[0.32em] select-none shrink-0">
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: '0.2em',
                      bottom: '0.2em'
                    }}
                  >
                    <RightParenSVG className="w-full h-full text-white/20" />
                  </div>
                </div>
              </div>
            ) : (
              <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
            )}
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className={`flex flex-col items-center justify-center ${inExponent ? 'mx-[0.05em] my-[0.02em] text-[0.7em] leading-none' : 'mx-[0.1em] my-[0.05em]'}`}>
            <div className={`w-full text-center ${inExponent ? 'pb-[0.02em]' : 'pb-[0.1em]'}`}>
              <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
            </div>
            <div className="w-full border-t border-white/10 h-0" />
            <div className={`w-full text-center ${inExponent ? 'pt-[0.02em]' : 'pt-[0.1em]'}`}>
              <PreviewEquationNode path={`${path}/1`} inExponent={inExponent} customEquation={customEquation} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering)
      if (opNode.op === '^') {
        return (
          <div className="inline-flex items-baseline relative" style={{ paddingTop: '0.8em' }}>
            <div>
              <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
            </div>
            <div className="relative" style={{ top: '-0.8em' }}>
              <div className="text-[0.65em] ml-[0.05em] opacity-70 scale-90" style={{ display: 'inline-block' }}>
                <PreviewEquationNode path={`${path}/1`} inExponent={true} customEquation={customEquation} />
              </div>
            </div>
          </div>
        );
      }

      // Normal binary operators (+, -, *) — centralized display glyphs (#28).
      const opSymbol = OPERATOR_DISPLAY[opNode.op] || opNode.op;

      return (
        <div className="flex items-center gap-[0.2em] flex-nowrap justify-center py-[0.05em]">
          <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
          <span className="text-indigo-400/60 font-medium text-[0.85em] select-none">{opSymbol}</span>
          <PreviewEquationNode path={`${path}/1`} inExponent={inExponent} customEquation={customEquation} />
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
            unwrapped = (unwrapped as math.ParenthesisNode).content;
          }
          if (unwrapped && unwrapped.type === 'ConstantNode' && (((unwrapped as math.ConstantNode).value as unknown) === 2 || ((unwrapped as math.ConstantNode).value as unknown) === '2')) {
            showIndex = false;
          }
        }
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            <div className="relative w-[0.7em] select-none shrink-0 mr-[-1px]">
              {showIndex && (
                <div className="absolute right-full top-0 -mt-[0.2em] -mr-[0.3em] text-[0.55em] scale-90 z-10">
                  <PreviewEquationNode path={`${path}/1`} inExponent={inExponent} customEquation={customEquation} />
                </div>
              )}
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full text-indigo-400/60"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M 1,55 L 3.5,55 L 7.5,98 L 12,1"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="border-t border-white/15 pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center">
              <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
            </div>
          </div>
        );
      }

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            <div className="relative w-[0.7em] select-none shrink-0 mr-[-1px]">
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full text-indigo-400/60"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M 1,55 L 3.5,55 L 7.5,98 L 12,1"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="border-t border-white/15 pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center">
              <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className="text-purple-400/60 font-medium text-[0.9em]">{nameStr}</span>
          <span className="text-white/20 mr-[0.05em]">(</span>
          <PreviewEquationNode path={`${path}/0`} inExponent={inExponent} customEquation={customEquation} />
          <span className="text-white/20 ml-[0.05em]">)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  return (
    <div
      data-flip-id={nodeId}
      className="relative inline-flex items-center justify-center p-[0.2em] border border-white/5 bg-white/0 rounded-[0.4em]"
    >
      {renderContent()}
    </div>
  );
};
