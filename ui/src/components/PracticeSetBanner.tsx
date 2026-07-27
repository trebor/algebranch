// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  activePracticeSetAtom,
  readyForNextProblemAtom,
  advancePracticeSetAtom,
  startPracticeSetAtom,
  exitPracticeSetAtom,
  recordProblemSolvedAtom,
} from '../store/ladders';
import { PRACTICE_SETS } from '../constants/ladders';
import { Sparkles, ArrowRight, Trophy, X } from 'lucide-react';
import { ConfettiBurst } from './ConfettiBurst';
import { useIsHydrated } from '../hooks/useIsHydrated';
import { EquationBanner } from './EquationBanner';

/**
 * Standing Practice Set "Next problem →" loop affordance (#500).
 *
 * Appears below the main equation canvas / terminal state caveats when a Practice Set
 * is active AND the current equation reaches a solved state or terminal status.
 */
export const PracticeSetBanner: React.FC = () => {
  const mounted = useIsHydrated();
  const active = useAtomValue(activePracticeSetAtom);
  const readyForNext = useAtomValue(readyForNextProblemAtom);
  const advanceSet = useSetAtom(advancePracticeSetAtom);
  const startSet = useSetAtom(startPracticeSetAtom);
  const exitSet = useSetAtom(exitPracticeSetAtom);
  const recordProblemSolved = useSetAtom(recordProblemSolvedAtom);
  const [shouldCelebrate, setShouldCelebrate] = React.useState(false);

  const activeSetId = active?.set.id ?? null;
  const activePosition = active?.position ?? 0;

  React.useEffect(() => {
    if (!activeSetId || !readyForNext) return;

    const isFresh = recordProblemSolved();
    if (isFresh) {
      const celebrateTimer = setTimeout(() => setShouldCelebrate(true), 0);
      const resetTimer = setTimeout(() => setShouldCelebrate(false), 2500);
      return () => {
        clearTimeout(celebrateTimer);
        clearTimeout(resetTimer);
      };
    }
  }, [activeSetId, activePosition, readyForNext, recordProblemSolved]);

  if (!active || !readyForNext) return null;

  const { set, position, isCompleted } = active;
  const totalProblems = set.presetIds.length;

  // Find next Practice Set if available
  const currentIndex = PRACTICE_SETS.findIndex((s) => s.id === set.id);
  const nextSet = PRACTICE_SETS[(currentIndex + 1) % PRACTICE_SETS.length];

  return (
    <>
      {shouldCelebrate && mounted && typeof document !== 'undefined' && createPortal(
        <ConfettiBurst key={`confetti_${set.id}_${position}`} />,
        document.body
      )}
      <EquationBanner
        variant={isCompleted ? 'emerald' : 'sky'}
        role="region"
        ariaLabel="Practice Set Progress"
        icon={
          isCompleted ? (
            <Trophy size={14} className="shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <Sparkles size={14} className="shrink-0 text-indigo-400" aria-hidden />
          )
        }
        className="w-full justify-between"
      >
        <span className="truncate">
          {isCompleted
            ? `Practice Set Complete — ${set.title}`
            : `Problem Solved · ${set.title} · ${position + 1} of ${totalProblems}`}
        </span>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {isCompleted ? (
            <button
              type="button"
              onClick={() => startSet({ setId: nextSet.id, position: 0 })}
              className="px-2 py-0.5 text-[0.7rem] font-bold rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 flex items-center gap-1 transition-colors"
            >
              <span>Next Set</span>
              <ArrowRight size={11} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => advanceSet()}
              className="px-2 py-0.5 text-[0.7rem] font-bold rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1 transition-colors"
            >
              <span>Next Problem</span>
              <ArrowRight size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => exitSet()}
            aria-label="Exit Practice Set"
            className="p-0.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </EquationBanner>
    </>
  );
};
