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

  const strip = (s: string) => s.replace(/\s+/g, '');

  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-1 flex-wrap select-none shrink-0">
      <span className={`text-[9px] uppercase tracking-wider font-semibold ${THEME_GLASS.TEXT_MUTED}`}>
        Available substitutions
      </span>
      {facts.map((fact, i) => {
        const factEq = { lhs: new math.SymbolNode(fact.variable), rhs: fact.expression };
        const eqStr = equationToString(factEq);
        // Tabs are often auto-named with their equation; showing "y = 2x · y = 2x"
        // is noise — only attribute the source when it adds information.
        const sourceLabel = fact.sourceName && strip(fact.sourceName) !== strip(eqStr)
          ? fact.sourceName
          : undefined;
        return (
          <Tooltip
            key={`${fact.sourceId ?? 'tutorial'}-${fact.variable}-${i}`}
            content={
              <TooltipCard
                eyebrow="Available substitution"
                meta={sourceLabel ? `from “${sourceLabel}”` : undefined}
                equation={factEq}
                footer={<span>Tap a teal handle on “{fact.variable}” in the equation to substitute</span>}
              />
            }
            position="top"
            autoAlign={false}
            className="max-w-[min(92vw,40rem)]"
          >
            <span className={THEME_GLASS.FACT_CHIP}>
              <span className={THEME_GLASS.FACT_CHIP_ICON}>
                <Replace size={9} className="shrink-0" />
              </span>
              <span className="font-mono">{eqStr}</span>
              {sourceLabel && (
                <span className={THEME_GLASS.FACT_CHIP_SOURCE}>· {sourceLabel}</span>
              )}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
};
