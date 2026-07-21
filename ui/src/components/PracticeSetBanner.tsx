// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  activePracticeSetAtom,
  readyForNextProblemAtom,
  advancePracticeSetAtom,
  startPracticeSetAtom,
  exitPracticeSetAtom,
} from '../store/ladders';
import { PRACTICE_SETS } from '../constants/ladders';
import { THEME_GLASS } from '../constants/theme';
import { Sparkles, ArrowRight, Trophy, X } from 'lucide-react';

/**
 * Standing Practice Set "Next problem →" loop affordance (#500).
 *
 * Appears below the main equation canvas / terminal state caveats when a Practice Set
 * is active AND the current equation reaches a solved state or terminal status.
 */
export const PracticeSetBanner: React.FC = () => {
  const active = useAtomValue(activePracticeSetAtom);
  const readyForNext = useAtomValue(readyForNextProblemAtom);
  const advanceSet = useSetAtom(advancePracticeSetAtom);
  const startSet = useSetAtom(startPracticeSetAtom);
  const exitSet = useSetAtom(exitPracticeSetAtom);

  if (!active || !readyForNext) return null;

  const { set, position, isCompleted } = active;
  const totalProblems = set.presetIds.length;

  // Find next Practice Set if available
  const currentIndex = PRACTICE_SETS.findIndex((s) => s.id === set.id);
  const nextSet = PRACTICE_SETS[(currentIndex + 1) % PRACTICE_SETS.length];

  return (
    <div
      role="region"
      aria-label="Practice Set Progress"
      className={`mt-3 p-3.5 rounded-2xl border transition-all animate-[fadeIn_0.2s_ease-out] flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isCompleted
          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
          : 'border-indigo-500/40 bg-indigo-950/30 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-xl shrink-0 ${
            isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
          }`}
        >
          {isCompleted ? <Trophy size={18} /> : <Sparkles size={18} />}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold tracking-wider uppercase opacity-80">
              Practice Set · {set.title}
            </span>
            <span
              className={`text-[0.625rem] font-mono font-semibold px-2 py-0.5 rounded-full ${
                isCompleted ? THEME_GLASS.ACTIVE_BADGE : THEME_GLASS.BADGE_MUTED
              }`}
            >
              {isCompleted ? 'Completed ✓' : `${position + 1} / ${totalProblems}`}
            </span>
          </div>
          <p className="text-xs text-white/90 font-medium truncate mt-0.5">
            {isCompleted
              ? `You've completed all ${totalProblems} problems in this Practice Set!`
              : `Problem solved! Ready to take on problem ${position + 2} of ${totalProblems}.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        {isCompleted ? (
          <button
            type="button"
            onClick={() => startSet({ setId: nextSet.id, position: 0 })}
            className={`h-8 px-3.5 text-xs font-bold flex items-center justify-center gap-1.5 ${THEME_GLASS.BUTTON_SUCCESS}`}
          >
            <span>Next Set: {nextSet.title}</span>
            <ArrowRight size={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => advanceSet()}
            className={`h-8 px-4 text-xs font-bold flex items-center justify-center gap-1.5 ${THEME_GLASS.BUTTON_PRIMARY}`}
          >
            <span>Next Problem</span>
            <ArrowRight size={13} />
          </button>
        )}

        <button
          type="button"
          onClick={() => exitSet()}
          aria-label="Exit Practice Set"
          className={`p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors`}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
