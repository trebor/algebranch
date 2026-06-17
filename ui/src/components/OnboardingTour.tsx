'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useIsHydrated } from '../hooks/useIsHydrated';
import {
  onboardingChapterIdAtom,
  onboardingStepIndexAtom,
  onboardingShowDirectoryAtom,
  currentEquationAtom,
  ONBOARDING_CHAPTERS,
  setOnboardingStepAtom,
  startOnboardingChapterAtom,
  sourcePathAtom,
  appHydratedAtom,
  readOnboardingSteps,
  clearOnboardingStep,
  syncTourToActiveTabAtom,
  activeTabIdAtom,
  tabsAtom
} from '../store/equation';
import { equationToString } from 'math-engine-client';
import { prefetchChapterScans } from '../utils/mathScan';
import Image from 'next/image';
import { Play, ArrowRight, ArrowLeft, CheckCircle2, X, BookOpen, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { THEME_GLASS, THEME_ANIMATIONS } from '../constants/theme';

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

// Confetti geometry is intentionally randomized once per burst. Generated at
// module scope (not in the component body) so the Math.random() calls are not
// flagged as impure render-phase work; the component memoizes one batch for its
// lifetime.
function makeConfettiPieces() {
  return Array.from({ length: 28 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    size: 5 + Math.random() * 5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: (Math.random() - 0.5) * 120,
    rotate: 360 + Math.random() * 540,
  }));
}

const ConfettiBurst: React.FC = () => {
  const pieces = React.useMemo(() => makeConfettiPieces(), []);

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
  const mounted = useIsHydrated();
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  // Per-chapter saved step (chapterId -> stepIndex) for the directory's resume UI.
  const [chapterProgress, setChapterProgress] = useState<Record<string, number>>({});

  const chapterId = useAtomValue(onboardingChapterIdAtom);
  const stepIndex = useAtomValue(onboardingStepIndexAtom);
  const [showDirectory, setShowDirectory] = useAtom(onboardingShowDirectoryAtom);
  const setStep = useSetAtom(setOnboardingStepAtom);
  const startChapter = useSetAtom(startOnboardingChapterAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const sourcePath = useAtomValue(sourcePathAtom);
  
  const [showPrompt, setShowPrompt] = useState(false);

  // Load saved states (from localStorage, an external store) on client mount.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load completed chapters
      const completedList = localStorage.getItem('algebranch_completed_chapters');
      if (completedList) {
        try {
          // Hydrating React state from localStorage (an external store) on mount
          // legitimately requires a synchronous setState in this effect.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCompletedChapters(JSON.parse(completedList));
        } catch (e) {
          console.error(e);
        }
      }

      // Load per-chapter saved step progress (for the directory's resume UI)
      setChapterProgress(readOnboardingSteps());
    }
  }, []);

  // The coach card follows the active workspace tab. Returning to an in-progress
  // tutorial tab reopens the tour at that chapter's saved step; switching to any
  // other tab (a fresh workspace, another chapter) hides it. This also handles
  // auto-resume on reload (the restored active tab drives the initial state),
  // and runs only after hydration so it sees the real tabs/sessions.
  //
  // Guarded to fire only on an actual tab switch, so the in-tour Exit/Finish
  // buttons (which don't change tabs) are respected and not undone.
  const appHydrated = useAtomValue(appHydratedAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const tabs = useAtomValue(tabsAtom);
  const syncTourToTab = useSetAtom(syncTourToActiveTabAtom);
  const prevTabIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!appHydrated) return;
    if (prevTabIdRef.current === activeTabId) return;
    prevTabIdRef.current = activeTabId;
    const activeChapterId = tabs.find(t => t.id === activeTabId)?.chapterId ?? null;
    syncTourToTab(activeChapterId);
  }, [appHydrated, activeTabId, tabs, syncTourToTab]);

  // Update saved progress state in real-time as local storage changes (so the directory dialog updates dynamically)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Re-sync React state from localStorage (external store) when progress
      // changes elsewhere; reflecting an external store requires setState here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapterProgress(readOnboardingSteps());

      const completedList = localStorage.getItem('algebranch_completed_chapters');
      if (completedList) {
        try {
          setCompletedChapters(JSON.parse(completedList));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [chapterId, stepIndex, showPrompt]);

  // Show the welcome prompt when explicitly requested (Tutorial button), or once
  // for a genuine first-time visitor. The progress-map check keeps it from
  // popping when a tab switch clears the active chapter mid-tour.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('algebranch_onboarding_completed');
      const neverStarted = Object.keys(readOnboardingSteps()).length === 0;
      // If the URL contains an equation or a workspace state, bypass the onboarding welcome prompt
      const hasUrlParam = /[?&](eq|ws)=/.test(window.location.search);
      // Derived from localStorage (external store) reads, so it can't be a
      // render-time computation; the setState belongs in this effect.
      if (showDirectory || (!completed && !chapterId && neverStarted && !hasUrlParam)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Escape on the opening prompt/directory skips straight into the app, so a
  // user who just wants to start solving isn't trapped by the tutorial.
  useEffect(() => {
    if (!showPrompt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkipPrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrompt]);

  const handleStartChapter = (id: string) => {
    setShowPrompt(false);
    setShowDirectory(false);
    // Resume this chapter at its own saved step (if any), else start fresh.
    const savedStep = chapterProgress[id];
    startChapter(id, savedStep ?? 0);
  };

  const handleAllChapters = () => {
    setStep(null);
    setShowDirectory(true);
  };

  const activeChapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  const activeStep = activeChapter && stepIndex !== null ? activeChapter.steps[stepIndex] : null;
  const isLastStep = activeChapter && stepIndex !== null ? stepIndex === activeChapter.steps.length - 1 : false;

  // Two-beat celebration: on solve, confetti bursts over the open workspace so
  // the solved equation stays visible; the chapter-complete modal arrives as a
  // second beat once the first wave has mostly fallen.
  const [celebrationReady, setCelebrationReady] = useState(false);
  // Celebration can only be live on a chapter's last step — force it off
  // otherwise during render (rather than a synchronous setState in the effect).
  if (celebrationReady && (!isLastStep || !chapterId)) {
    setCelebrationReady(false);
  }
  useEffect(() => {
    if (!isLastStep || !chapterId) return;
    const timer = setTimeout(() => setCelebrationReady(true), 2000);
    return () => clearTimeout(timer);
  }, [isLastStep, chapterId]);

  // Record a chapter as completed the moment its celebration (last step) is
  // reached, so the directory shows a green check regardless of which finish
  // action the user takes (next chapter / finish / all chapters / explore).
  useEffect(() => {
    if (!isLastStep || !chapterId) return;
    // Milestone persistence: records completion and writes it through to
    // localStorage (external store) — an inherently effect-bound side effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompletedChapters((prev) => {
      if (prev.includes(chapterId)) return prev;
      const next = [...prev, chapterId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('algebranch_completed_chapters', JSON.stringify(next));
      }
      return next;
    });
    // Drop the in-progress step so the coach won't reopen on this (now finished)
    // tab; the directory shows its green check instead.
    clearOnboardingStep(chapterId);
    setChapterProgress(readOnboardingSteps());
  }, [isLastStep, chapterId]);

  // Render the initial Welcome/Chapter directory prompt
  if (showPrompt) {
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`${THEME_GLASS.PANEL} max-w-md w-full p-6 flex flex-col gap-6 ${THEME_GLASS.TOOLTIP_DETAILS}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Algebranch"
                width={40}
                height={40}
                className="h-10 w-10 object-contain rounded-full shrink-0"
              />
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
              {ONBOARDING_CHAPTERS.map((chapter) => {
                const isCompleted = completedChapters.includes(chapter.id);
                const savedStep = chapterProgress[chapter.id];
                const hasProgress = !isCompleted && savedStep !== undefined && savedStep > 0;

                return (
                  <button
                    key={chapter.id}
                    onClick={() => handleStartChapter(chapter.id)}
                    className={`w-full text-left p-3 rounded-xl border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all flex items-center justify-between gap-3 cursor-pointer group`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox / Status indicator */}
                      <div className="shrink-0">
                        {isCompleted ? (
                          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={13} />
                          </div>
                        ) : hasProgress ? (
                          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                            <Play size={13} />
                          </div>
                        ) : (
                          <div className={`p-1 rounded-md bg-white/5 text-white/20 border border-white/10`}>
                            <div className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {chapter.title}
                          </p>
                          {hasProgress && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                              Resume Step {savedStep + 1}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] ${THEME_GLASS.TEXT_MUTED_LIGHT} truncate mt-0.5`}>
                          {chapter.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className={`${THEME_GLASS.TEXT_MUTED_EXTRA} group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0`} />
                  </button>
                );
              })}
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
      </div>,
      document.body
    );
  }

  // Render the celebratory chapter-complete modal on the final step
  if (activeChapter && activeStep && stepIndex !== null && isLastStep) {
    const chapterIndex = ONBOARDING_CHAPTERS.findIndex(c => c.id === activeChapter.id);
    const nextChapter = chapterIndex >= 0 ? ONBOARDING_CHAPTERS[chapterIndex + 1] : undefined;

    const handleFinish = () => setStep(null);

    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(
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
      </div>,
      document.body
    );
  }

  // Render the step walkthrough helper card
  if (activeChapter && activeStep !== null && stepIndex !== null) {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        transition={THEME_ANIMATIONS.LAYOUT_TRANSITION}
        className="w-full shrink-0 border-t border-white/10 bg-[#110f22]/60 backdrop-blur-md rounded-b-2xl px-4 py-3 sm:px-6 z-40 overflow-hidden"
      >
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleAllChapters}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer group/title"
              aria-label="Chapters menu"
            >
              <BookOpen size={13} className="group-hover/title:scale-110 transition-transform" />
              <span className="text-[10px] font-bold tracking-wider uppercase hover:underline">{activeChapter.title}</span>
            </button>
            <button
              onClick={() => setStep(null)}
              className={`text-[10px] font-bold ${THEME_GLASS.TEXT_MUTED} hover:text-white transition-colors cursor-pointer flex items-center gap-1`}
              aria-label="Exit tour"
            >
              <span>Exit Tour</span>
              <X size={10} className="shrink-0" />
            </button>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
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
            <span className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} font-bold`}>
              Step {stepIndex + 1} of {activeChapter.steps.length}
            </span>
            
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
        </div>
      </motion.div>
    );
  }

  return null;
};
