'use client';

import React, { useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  onboardingChapterIdAtom,
  onboardingStepIndexAtom,
  onboardingShowDirectoryAtom,
  currentEquationAtom,
  ONBOARDING_CHAPTERS,
  setOnboardingStepAtom,
  startOnboardingChapterAtom,
  sourcePathAtom
} from '../store/equation';
import { equationToString } from 'math-engine-client';
import { prefetchChapterScans } from '../utils/mathScan';
import { Play, ArrowRight, ArrowLeft, CheckCircle2, X, Sparkles, BookOpen, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { THEME_GLASS } from '../constants/theme';

// Node-color palette for the completion confetti (indigo, emerald, amber, sky, rose)
const CONFETTI_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#38bdf8', '#fb7185'];

// Legend swatches reuse the live node semantics from THEME_GLASS so the tutorial
// can never drift from the real Candidate/Static node styling. Text color and
// cursor are stripped: each swatch sets its own text color, and swatches aren't clickable.
const SWATCH_MOVABLE = THEME_GLASS.CARD_CANDIDATE_SCAN
  .replace('text-sky-100', '')
  .replace('cursor-pointer', '');
const SWATCH_LOCKED = THEME_GLASS.STATIC.replace('cursor-default', '');
const SWATCH_SOURCE = THEME_GLASS.SOURCE.replace('cursor-pointer', '');
const SWATCH_TARGET = THEME_GLASS.TARGET.replace('cursor-pointer', '');

const ConfettiBurst: React.FC = () => {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.8 + Math.random() * 1.4,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (Math.random() - 0.5) * 120,
        rotate: 360 + Math.random() * 540,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: `${p.left}%`,
            top: '-3%',
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
          }}
          initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '108vh', x: p.drift, opacity: [1, 1, 0.85, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
};

export const OnboardingTour: React.FC = () => {
  const chapterId = useAtomValue(onboardingChapterIdAtom);
  const stepIndex = useAtomValue(onboardingStepIndexAtom);
  const [showDirectory, setShowDirectory] = useAtom(onboardingShowDirectoryAtom);
  const setStep = useSetAtom(setOnboardingStepAtom);
  const startChapter = useSetAtom(startOnboardingChapterAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const sourcePath = useAtomValue(sourcePathAtom);
  
  const [showPrompt, setShowPrompt] = useState(false);

  // Check localStorage and showDirectory atom on mount / change to show prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('algebranch_onboarding_completed');
      if (showDirectory || (!completed && !chapterId)) {
        setShowPrompt(true);
      } else {
        setShowPrompt(false);
      }
    }
  }, [chapterId, showDirectory]);

  // Pre-warm the math scan cache for the chapter's known derivation chain so
  // stepping through the tutorial never waits on the backend. Runs once per
  // chapter start (the initial-equation guard makes later re-runs no-ops).
  useEffect(() => {
    if (!chapterId || !currentEq) return;
    const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
    if (!chapter) return;
    if (equationToString(currentEq).replace(/\s+/g, '') !== chapter.initialEquation.replace(/\s+/g, '')) return;

    let active = true;
    prefetchChapterScans(chapter, currentEq, () => active).catch(err => {
      console.warn('Tutorial scan prefetch failed (live fetches will cover):', err);
    });
    return () => {
      active = false;
    };
  }, [chapterId, currentEq]);

  // Synchronize walkthrough step index automatically when the user performs the correct math operation or selects a node
  useEffect(() => {
    if (!chapterId || stepIndex === null || !currentEq) return;

    const activeChapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
    if (!activeChapter) return;

    const currentStr = equationToString(currentEq).replace(/\s+/g, '');
    const activeStep = activeChapter.steps[stepIndex];

    // Statically derive the equation this step starts from (chapter data, not live state)
    const stepStartEq = stepIndex > 0
      ? activeChapter.steps[stepIndex - 1].nextEquation
      : activeChapter.initialEquation;
    const stepStartStr = stepStartEq.replace(/\s+/g, '');
    const nextStr = activeStep.nextEquation.replace(/\s+/g, '');

    // No-op steps expect no equation change: informational cards (highlightPath null)
    // or selection prompts (highlightPath set). They must never auto-advance on an
    // equation match — the start state already matches their nextEquation.
    const isNoOpStep = nextStr !== '' && nextStr === stepStartStr;

    if (isNoOpStep) {
      // Selection steps advance when the user selects the highlighted node;
      // informational steps advance only via the Next button.
      if (activeStep.highlightPath !== null && sourcePath === activeStep.highlightPath) {
        setStep(stepIndex + 1);
        return;
      }
    } else if (nextStr !== '' && currentStr === nextStr) {
      // Action steps advance when the equation reaches the expected result
      setStep(stepIndex + 1);
      return;
    }

    // Sync the step index backward only when the equation has left this step's
    // expected start state (e.g. the user jumped back in the history tree).
    // Guarding on stepStartStr matters: selection/info steps share their start
    // equation with neighbors, so an unguarded match would bounce Next right back.
    if (currentStr !== stepStartStr && stepIndex > 0) {
      const targetRegressIndex = stepIndex - 1;
      const targetStep = activeChapter.steps[targetRegressIndex];

      // Only auto-regress to active math steps (where highlightPath is not null)
      if (targetStep.highlightPath !== null) {
        const startEqOfTarget = targetRegressIndex > 0
          ? activeChapter.steps[targetRegressIndex - 1].nextEquation
          : activeChapter.initialEquation;

        if (startEqOfTarget) {
          const targetStr = startEqOfTarget.replace(/\s+/g, '');
          if (currentStr === targetStr) {
            setStep(targetRegressIndex);
            return;
          }
        }
      }
    }
  }, [currentEq, chapterId, stepIndex, sourcePath, setStep]);

  const handleSkipPrompt = () => {
    setShowPrompt(false);
    setShowDirectory(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('algebranch_onboarding_completed', 'true');
    }
  };

  const handleStartChapter = (id: string) => {
    setShowPrompt(false);
    setShowDirectory(false);
    startChapter(id);
  };

  const activeChapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  const activeStep = activeChapter && stepIndex !== null ? activeChapter.steps[stepIndex] : null;
  const isLastStep = activeChapter && stepIndex !== null ? stepIndex === activeChapter.steps.length - 1 : false;

  // Two-beat celebration: on solve, confetti bursts over the open workspace so
  // the solved equation stays visible; the chapter-complete modal arrives as a
  // second beat once the first wave has mostly fallen.
  const [celebrationReady, setCelebrationReady] = useState(false);
  useEffect(() => {
    if (!isLastStep || !chapterId) {
      setCelebrationReady(false);
      return;
    }
    const timer = setTimeout(() => setCelebrationReady(true), 2000);
    return () => clearTimeout(timer);
  }, [isLastStep, chapterId]);

  // Render the initial Welcome/Chapter directory prompt
  if (showPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`${THEME_GLASS.PANEL} max-w-md w-full p-6 flex flex-col gap-6 ${THEME_GLASS.TOOLTIP_DETAILS}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base lg:text-lg">Welcome to Algebranch!</h3>
                <p className="text-[10px] text-indigo-300/60 font-medium">Interactive Algebra Tour</p>
              </div>
            </div>
            <button
              onClick={handleSkipPrompt}
              className={`hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer ${THEME_GLASS.TEXT_MUTED} hover:text-white`}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <p className={`text-xs ${THEME_GLASS.TEXT_MUTED_BRIGHT} leading-relaxed`}>
              Algebranch is an interactive sandbox where you manipulate equations by tapping and transposing terms. Choose an interactive chapter below to learn the ropes!
            </p>
            
            <div className="flex flex-col gap-2.5 mt-2">
              {ONBOARDING_CHAPTERS.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => handleStartChapter(chapter.id)}
                  className={`w-full text-left p-3 rounded-xl border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all flex items-center justify-between gap-3 cursor-pointer group`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">{chapter.title}</p>
                    <p className={`text-[10px] ${THEME_GLASS.TEXT_MUTED_LIGHT} truncate mt-0.5`}>{chapter.description}</p>
                  </div>
                  <ArrowRight size={14} className={`${THEME_GLASS.TEXT_MUTED_EXTRA} group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0`} />
                </button>
              ))}
            </div>
          </div>

          <div className={`flex items-center justify-end gap-3 pt-2 border-t ${THEME_GLASS.PANEL_BORDER}`}>
            <button
              onClick={handleSkipPrompt}
              className={`px-4 py-2 text-xs font-bold ${THEME_GLASS.TEXT_MUTED_LIGHT} hover:text-white transition-colors cursor-pointer`}
            >
              Skip and Solve Freely
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render the celebratory chapter-complete modal on the final step
  if (activeChapter && activeStep && stepIndex !== null && isLastStep) {
    const chapterIndex = ONBOARDING_CHAPTERS.findIndex(c => c.id === activeChapter.id);
    const nextChapter = chapterIndex >= 0 ? ONBOARDING_CHAPTERS[chapterIndex + 1] : undefined;

    const handleFinish = () => setStep(null);
    const handleAllChapters = () => {
      setStep(null);
      setShowDirectory(true);
    };

    return (
      <div className="fixed inset-0 z-50 pointer-events-none">
        {/* Beat 1: confetti over the open workspace — the solved equation stays visible */}
        <ConfettiBurst />

        {/* Beat 2: backdrop + chapter-complete modal, with a second confetti wave */}
        {celebrationReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-auto flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <ConfettiBurst />
        <motion.div
          initial={{ scale: 0.9, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={`${THEME_GLASS.PANEL} max-w-sm w-full p-6 flex flex-col items-center gap-4 text-center shadow-[0_0_40px_rgba(52,211,153,0.2)] border border-emerald-500/20`}
        >
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
            className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_25px_rgba(52,211,153,0.35)]"
          >
            <Trophy size={26} />
          </motion.div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400/80">
              Chapter Complete — {activeChapter.title}
            </span>
            <h3 className="font-bold text-white text-base lg:text-lg">{activeStep.title}</h3>
            <p className={`text-xs ${THEME_GLASS.TEXT_MUTED_BRIGHT} leading-relaxed`}>{activeStep.description}</p>
          </div>

          <div className="flex flex-col gap-2.5 w-full pt-2">
            {nextChapter ? (
              <button
                onClick={() => startChapter(nextChapter.id)}
                className={`w-full h-9 px-4 text-xs font-bold flex items-center justify-center gap-2 ${THEME_GLASS.BUTTON_PRIMARY}`}
              >
                <span>Next: {nextChapter.title.split('. ')[1] || nextChapter.title}</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className={`w-full h-9 px-4 text-xs font-bold flex items-center justify-center gap-2 ${THEME_GLASS.BUTTON_SUCCESS}`}
              >
                <CheckCircle2 size={13} />
                <span>Finish &amp; Explore Freely</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleAllChapters}
                className={`text-[11px] font-bold ${THEME_GLASS.TEXT_MUTED_LIGHT} hover:text-white transition-colors cursor-pointer flex items-center gap-1.5`}
              >
                <BookOpen size={11} />
                <span>All Chapters</span>
              </button>
              {nextChapter && (
                <button
                  onClick={handleFinish}
                  className={`text-[11px] font-bold ${THEME_GLASS.TEXT_MUTED_LIGHT} hover:text-white transition-colors cursor-pointer`}
                >
                  Explore Freely
                </button>
              )}
            </div>
          </div>
        </motion.div>
          </motion.div>
        )}
      </div>
    );
  }

  // Render the step walkthrough helper card
  if (activeChapter && activeStep !== null && stepIndex !== null) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={THEME_GLASS.COACH_CARD}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <BookOpen size={13} />
              <span className="text-[10px] font-bold tracking-wider uppercase">{activeChapter.title}</span>
            </div>
            <span className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} font-bold`}>
              Step {stepIndex + 1} of {activeChapter.steps.length}
            </span>
          </div>

          {/* Title & Desc */}
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-bold text-white">{activeStep.title}</h4>
            <p className={`text-[11px] ${THEME_GLASS.TEXT_MUTED_BRIGHT} leading-relaxed mt-0.5`}>
              {activeStep.description}
            </p>
          </div>

          {/* Node-kind color legend (steps with legend: 'nodeTypes') */}
          {activeStep.legend === 'nodeTypes' && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className={`flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border ${THEME_GLASS.PANEL_BORDER} text-white/95`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_MOVABLE} text-sky-300 font-serif italic font-medium text-[10px]`}>x</span>
                <div className="flex flex-col">
                  <span className="font-bold text-white/90 text-[9px] leading-tight">Variable</span>
                  <span className="text-sky-300/80 text-[7px] leading-none">The unknown to find</span>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border ${THEME_GLASS.PANEL_BORDER} text-white/95`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_MOVABLE} text-yellow-400/90 font-semibold text-[10px]`}>3</span>
                <div className="flex flex-col">
                  <span className="font-bold text-white/90 text-[9px] leading-tight">Constant</span>
                  <span className="text-yellow-400/85 text-[7px] leading-none">A known number</span>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border ${THEME_GLASS.PANEL_BORDER} text-white/95`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_MOVABLE} text-white/90 font-bold text-[10px]`}>+</span>
                <div className="flex flex-col">
                  <span className="font-bold text-white/90 text-[9px] leading-tight">Operator</span>
                  <span className={`${THEME_GLASS.TEXT_MUTED} text-[7px] leading-none`}>Combines terms</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 text-zinc-500">
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_LOCKED} text-[10px]`}>4</span>
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-400 text-[9px] leading-tight font-medium">Immobile</span>
                  <span className="text-zinc-500/80 text-[7px] leading-none font-sans">Locked in place</span>
                </div>
              </div>
            </div>
          )}

          {/* Selection-state color legend (steps with legend: 'sourceTarget') */}
          {activeStep.legend === 'sourceTarget' && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className={`flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border ${THEME_GLASS.PANEL_BORDER} text-white/95`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_SOURCE} text-[10px]`}>4</span>
                <div className="flex flex-col">
                  <span className="font-bold text-white/90 text-[9px] leading-tight">Source</span>
                  <span className="text-indigo-300/80 text-[7px] leading-none">The term you picked up</span>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border ${THEME_GLASS.PANEL_BORDER} text-white/95`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${SWATCH_TARGET} text-[10px]`}>11</span>
                <div className="flex flex-col">
                  <span className="font-bold text-white/90 text-[9px] leading-tight">Target</span>
                  <span className="text-emerald-300/80 text-[7px] leading-none">Tap to drop it there</span>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={`flex items-center justify-between pt-2 border-t ${THEME_GLASS.PANEL_BORDER} mt-1`}>
            <button
              onClick={() => setStep(null)}
              className={`text-[10px] font-bold ${THEME_GLASS.TEXT_MUTED} hover:text-white transition-colors cursor-pointer`}
            >
              Exit Tour
            </button>
            
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={() => setStep(stepIndex - 1)}
                  className={`h-7 px-2.5 text-[10px] font-bold flex items-center gap-1 ${THEME_GLASS.BUTTON_SECONDARY}`}
                >
                  <ArrowLeft size={10} />
                  <span>Back</span>
                </button>
              )}
              
              <button
                onClick={() => setStep(isLastStep ? null : stepIndex + 1)}
                className={`h-7 px-3 text-[10px] font-bold flex items-center gap-1 ${THEME_GLASS.BUTTON_PRIMARY}`}
              >
                <span>{isLastStep ? 'Finish' : 'Next'}</span>
                {isLastStep ? <CheckCircle2 size={10} /> : <ArrowRight size={10} />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};
