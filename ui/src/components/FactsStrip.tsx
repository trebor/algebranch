'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { Replace } from 'lucide-react';
import { availableFactsAtom } from '../store/equation';
import { equationToString } from 'math-engine-client';
import { THEME_GLASS } from '../constants/theme';
import { Tooltip } from './Tooltip';
import { TooltipCard } from './TooltipCard';

/**
 * Slim strip listing the substitution facts available to the active workspace
 * (#3): variables isolated in OTHER workspace tabs. Provenance for the teal
 * Replace handles — hidden entirely when no facts exist.
 */
export const FactsStrip: React.FC = () => {
  const facts = useAtomValue(availableFactsAtom);
  if (facts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 pt-2 flex-wrap select-none">
      <span className={`text-[9px] uppercase tracking-wider font-semibold ${THEME_GLASS.TEXT_MUTED}`}>
        Known equations
      </span>
      {facts.map((fact, i) => {
        const factEq = { lhs: new math.SymbolNode(fact.variable), rhs: fact.expression };
        return (
          <Tooltip
            key={`${fact.sourceId ?? 'tutorial'}-${fact.variable}-${i}`}
            content={
              <TooltipCard
                eyebrow="Known equation"
                meta={fact.sourceName ? `from “${fact.sourceName}”` : undefined}
                equation={factEq}
                footer={<span>Tap a teal handle on “{fact.variable}” in the equation to substitute</span>}
              />
            }
            position="bottom"
            className="max-w-[min(92vw,40rem)]"
          >
            <span className={THEME_GLASS.FACT_CHIP}>
              <Replace size={10} className="shrink-0" />
              <span className="font-mono">{equationToString(factEq)}</span>
              {fact.sourceName && (
                <span className={THEME_GLASS.FACT_CHIP_SOURCE}>· {fact.sourceName}</span>
              )}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
};
