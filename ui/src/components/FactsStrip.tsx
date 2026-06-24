// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { mjs } from 'math-engine';
import { Replace } from 'lucide-react';
import { applicableFactsAtom } from '../store/equation';
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
  const facts = useAtomValue(applicableFactsAtom);
  if (facts.length === 0) return null;

  const strip = (s: string) => s.replace(/\s+/g, '');

  return (
    // One row, horizontally scrollable — same overflow treatment as the tab bar
    // above, so narrow screens swipe sideways instead of clipping or wrapping.
    // The BottomNav overlap is reserved once on the workspace-column wrapper via
    // --bottom-nav-clearance (#251), so the strip carries no nav clearance itself.
    <div className="flex items-center gap-2 px-3 pb-2 pt-1 select-none shrink-0 min-w-0">
      <span className={`shrink-0 text-[0.5625rem] tracking-wider font-semibold ${THEME_GLASS.TEXT_MUTED}`}>
        Substitutions
      </span>
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0 py-0.5">
      {facts.map((fact, i) => {
        const factEq = { lhs: new mjs.SymbolNode(fact.variable), rhs: fact.expression };
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
