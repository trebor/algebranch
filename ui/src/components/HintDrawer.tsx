// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  hintActiveAtom,
  hintLevelAtom,
  hintLadderAtom,
  hintLoadingAtom,
} from '../store/hint';
import { THEME_GLASS } from '../constants/theme';

export const HintDrawer: React.FC = () => {
  const [active] = useAtom(hintActiveAtom);
  const [level, setLevel] = useAtom(hintLevelAtom);
  const ladder = useAtomValue(hintLadderAtom);
  const loading = useAtomValue(hintLoadingAtom);

  if (!active) return null;

  if (loading && !ladder) {
    return (
      <aside
        aria-label="Hint Guidance Calculating"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 transition-all duration-300 ease-in-out"
      >
        <div className={`p-3.5 ${THEME_GLASS.PANEL} border-amber-500/30 shadow-[0_0_30px_rgba(251,191,36,0.15)] flex items-center justify-between gap-3 backdrop-blur-xl`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Lightbulb className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[0.65rem] font-bold text-amber-400 uppercase tracking-wider">
                Hint
              </span>
              <p className="text-xs font-semibold text-white/70 animate-pulse truncate">
                Finding next hint...
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (!ladder) return null;

  const handlePrevTier = () => {
    if (level > 1) {
      setLevel(level - 1);
    }
  };

  const handleNextTier = () => {
    if (level < 3) {
      setLevel(level + 1);
    }
  };

  return (
    <aside
      aria-label="Hint Ladder Guidance"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 transition-all duration-300 ease-in-out"
    >
      <div aria-live="polite" className="sr-only">
        {level === 1 && `Goal Hint: ${ladder.strategicGoal}`}
        {level === 2 && `Focus Hint: ${ladder.focusDescription}`}
        {level === 3 && `Action Hint: ${ladder.actionableMove}`}
      </div>

      <div className={`p-3.5 ${THEME_GLASS.PANEL} border-amber-500/30 shadow-[0_0_30px_rgba(251,191,36,0.15)] flex flex-col gap-2.5 backdrop-blur-xl`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Lightbulb className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-bold text-amber-400 uppercase tracking-wider">
                  Hint {level} of 3
                </span>
                <span className="text-[0.65rem] text-white/40 font-mono">
                  {level === 1 ? 'Goal' : level === 2 ? 'Target' : 'Action'}
                </span>
              </div>
              <p className="text-xs font-semibold text-white truncate">
                {level === 1 && ladder.strategicGoal}
                {level === 2 && ladder.focusDescription}
                {level === 3 && ladder.actionableMove}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Previous Hint step */}
            <button
              onClick={handlePrevTier}
              disabled={level <= 1}
              className={`p-1.5 rounded-lg border transition-all ${
                level <= 1
                  ? 'border-white/5 bg-neutral-900/30 text-white/20 cursor-not-allowed'
                  : 'border-amber-500/30 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 cursor-pointer active:scale-95'
              }`}
              title={level <= 1 ? 'First hint step' : 'Previous hint step'}
              aria-label="Previous hint step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Next Hint step */}
            <button
              onClick={handleNextTier}
              disabled={level >= 3}
              className={`p-1.5 rounded-lg border transition-all ${
                level >= 3
                  ? 'border-white/5 bg-neutral-900/30 text-white/20 cursor-not-allowed'
                  : 'border-amber-500/30 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 cursor-pointer active:scale-95'
              }`}
              title={level >= 3 ? 'Final hint step reached' : 'Next hint step'}
              aria-label="Next hint step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
