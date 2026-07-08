// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type * as math from 'mathjs';
import { PreviewEquationNode } from './PreviewEquationNode';
import { THEME_GLASS } from '../constants/theme';
import { mjs } from 'math-engine';
import type { StepChange } from 'math-engine';
import { sentenceCase } from '../utils/text';

export interface TransitionTooltipCardProps {
  readonly parentStepNum: number;
  readonly childStepNum: number;
  readonly description: string;
  readonly change?: StepChange;
  readonly assumptions?: readonly string[];
}

const OP_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '−',
  multiply: '⋅',
  divide: '/',
  power: '^',
  root: '√',
};

/**
 * Renders a detailed tooltip layout for connection edge transition handles.
 * Shows the operation description as the title, a large prominent step-to-step
 * flow, and a pretty-typeset mathematical representation of the sub-expression change.
 */
export const TransitionTooltipCard: React.FC<TransitionTooltipCardProps> = ({
  parentStepNum,
  childStepNum,
  description,
  change,
  assumptions,
}) => {
  const renderMathBody = () => {
    if (change) {
      if (change.kind === 'bothSides') {
        let parsedNode: math.MathNode | null = null;
        try {
          parsedNode = mjs.parse(change.operand);
        } catch {
          // Ignore parse errors
        }

        if (change.op === 'power') {
          return (
            <div className="flex items-start justify-center py-2 font-mono">
              <span className="text-3xl font-light text-indigo-400 select-none mr-1">( )</span>
              <span className="text-base font-semibold text-white relative -top-2">
                {parsedNode ? <PreviewEquationNode customNode={parsedNode} /> : change.operand}
              </span>
            </div>
          );
        }

        if (change.op === 'root') {
          const isSquareRoot = change.operand === '2';
          return (
            <div className="flex items-center justify-center py-2 select-none font-mono">
              {!isSquareRoot && (
                <span className="text-[0.65em] font-bold text-indigo-400 mr-[-0.2em] relative -top-2">
                  {change.operand}
                </span>
              )}
              <span className="text-3xl font-light text-indigo-400 mr-1">√</span>
              <span className="text-3xl font-light text-white/20">( )</span>
            </div>
          );
        }

        const symbol = OP_SYMBOLS[change.op] || '';
        return (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-2xl font-bold text-indigo-400 select-none font-mono">{symbol}</span>
            <span className="text-xl font-semibold text-white">
              {parsedNode ? <PreviewEquationNode customNode={parsedNode} /> : change.operand}
            </span>
          </div>
        );
      }

      if (change.kind === 'rewrite' && change.detail) {
        const parts = change.detail.split(/ → | = |→|=/);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          let parsedBefore: math.MathNode | null = null;
          let parsedAfter: math.MathNode | null = null;
          try {
            parsedBefore = mjs.parse(parts[0].trim());
            parsedAfter = mjs.parse(parts[1].trim());
          } catch {
            // Ignore parse errors
          }

          if (parsedBefore && parsedAfter) {
            const separator = change.detail.includes('=') ? '=' : '→';
            return (
              <div className="flex items-center justify-center gap-3 py-2 flex-wrap font-sans">
                <span className="text-base font-semibold text-white/80">
                  <PreviewEquationNode customNode={parsedBefore} />
                </span>
                <span className="text-indigo-400 font-bold select-none text-lg">
                  {separator}
                </span>
                <span className="text-base font-semibold text-white">
                  <PreviewEquationNode customNode={parsedAfter} />
                </span>
              </div>
            );
          }
        }

        // Try parsing the whole detail as a fallback
        let parsedDetail: math.MathNode | null = null;
        try {
          parsedDetail = mjs.parse(change.detail);
        } catch {
          // Ignore parse errors
        }

        if (parsedDetail) {
          return (
            <div className="flex items-center justify-center py-2">
              <span className="text-base font-semibold text-white">
                <PreviewEquationNode customNode={parsedDetail} />
              </span>
            </div>
          );
        }

        return (
          <div className="text-center py-2 text-sm font-semibold text-zinc-300 break-all font-mono">
            {change.detail}
          </div>
        );
      }
    }

    // Fallback parsing from description text
    const lowerDesc = description.toLowerCase();
    let op: string | null = null;
    let operandStr = '';
    if (lowerDesc.startsWith('add ')) {
      op = 'add';
      operandStr = description.substring(4);
    } else if (lowerDesc.startsWith('subtract ')) {
      op = 'subtract';
      operandStr = description.substring(9);
    } else if (lowerDesc.startsWith('multiply ')) {
      op = 'multiply';
      operandStr = description.substring(9);
    } else if (lowerDesc.startsWith('divide ')) {
      op = 'divide';
      operandStr = description.substring(7);
    }

    if (op && operandStr) {
      let parsedNode: math.MathNode | null = null;
      try {
        parsedNode = mjs.parse(operandStr.trim());
      } catch {
        // Ignore parse errors
      }

      const symbol = OP_SYMBOLS[op] || '';
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-2xl font-bold text-indigo-400 select-none font-mono">{symbol}</span>
          <span className="text-xl font-semibold text-white">
            {parsedNode ? <PreviewEquationNode customNode={parsedNode} /> : operandStr}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col gap-2 text-left w-full">
      {/* Header section with step transition styled like TooltipCard eyebrow */}
      <div className={`flex items-center justify-between gap-8 border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-1.5`}>
        <span className={THEME_GLASS.TOOLTIP_EYEBROW}>
          Step {parentStepNum} → {childStepNum}
        </span>
      </div>

      {/* Title: the concise operation name (e.g. "Factor", "Distribute"). The
          full before → after is typeset just below, so the title stays short
          rather than restating the whole sentence carried in `change.text`. */}
      <span className={THEME_GLASS.TOOLTIP_TITLE}>
        {sentenceCase(change?.kind === 'rewrite' && change.label ? change.label : description)}
      </span>

      {/* Body: Math representation of the step */}
      {renderMathBody()}

      {/* Domain restriction caveats */}
      {assumptions && assumptions.length > 0 && (
        <span className={THEME_GLASS.TOOLTIP_ASSUMPTION}>
          <TriangleAlert size={12} className={THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} />
          <span>assuming {assumptions.join(', ')}</span>
        </span>
      )}
    </div>
  );
};
