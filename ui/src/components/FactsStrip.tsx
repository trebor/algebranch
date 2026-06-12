'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { Replace } from 'lucide-react';
import { availableFactsAtom, onboardingChapterIdAtom, graphSizeAtom } from '../store/equation';
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
  const inTour = !!useAtomValue(onboardingChapterIdAtom);
  const graphSize = useAtomValue(graphSizeAtom);
  if (facts.length === 0) return null;

  const strip = (s: string) => s.replace(/\s+/g, '');

  return (
    // One row, horizontally scrollable — same overflow treatment as the tab bar
    // above, so narrow screens swipe sideways instead of clipping or wrapping.
    // On mobile the fixed BottomNav overlays the bottom of the panel, so the
    // strip clears its height (+ safe area) — except during the tour, when the
    // nav is hidden and the coach card docks directly below.
    <div className={`flex items-center gap-2 px-3 pb-2 pt-1 select-none shrink-0 min-w-0 ${
      inTour ? '' : graphSize === 'hidden' ? 'max-lg:mb-[calc(3.5rem+env(safe-area-inset-bottom))]' : ''
    }`}>
      <span className={`shrink-0 text-[9px] uppercase tracking-wider font-semibold ${THEME_GLASS.TEXT_MUTED}`}>
        Substitutions
      </span>
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0 py-0.5">
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
    </div>
  );
};
