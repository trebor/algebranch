'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Equation, equationToString } from 'math-engine';
import {
  historyAtom,
  currentIndexAtom,
  resetToEquationStringAtom,
  sourcePathAtom,
  hoverPathAtom,
} from '../store/equation';
import { MATH_PRESETS, THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { RotateCcw, ChevronLeft, ChevronRight, Hash, Play, BookOpen, Copy, Check } from 'lucide-react';

// Global Index Value Constants
const INDEX_INCREMENT = 1;
const DEFAULT_ZERO = 0;
const COPIED_TIMEOUT = 2000;

export const Sidebar: React.FC = () => {
  const [history, setHistory] = useAtom(historyAtom);
  const [currentIndex, setCurrentIndex] = useAtom(currentIndexAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopyStep = (e: React.MouseEvent, eq: Equation, idx: number) => {
    e.stopPropagation();
    const eqStr = equationToString(eq);
    navigator.clipboard.writeText(eqStr).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => {
        setCopiedIndex(null);
      }, COPIED_TIMEOUT);
    });
  };

  const canUndo = currentIndex > DEFAULT_ZERO;
  const canRedo = currentIndex < history.length - INDEX_INCREMENT;

  const handleUndo = () => {
    if (canUndo) {
      setCurrentIndex((prev) => prev - INDEX_INCREMENT);
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setCurrentIndex((prev) => prev + INDEX_INCREMENT);
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleResetAll = () => {
    if (history.length > DEFAULT_ZERO) {
      const initialEq = history[DEFAULT_ZERO];
      setHistory([initialEq]);
      setCurrentIndex(DEFAULT_ZERO);
      setSourcePath(null);
      setHoverPath(null);
    }
  };

  const handleStepClick = (idx: number) => {
    setCurrentIndex(idx);
    setSourcePath(null);
    setHoverPath(null);
  };

  const handlePresetSelect = (eqStr: string) => {
    try {
      resetToEquation(eqStr);
    } catch (err) {
      alert(`Error loading preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className={`w-80 h-full flex flex-col gap-6 p-5 ${THEME_GLASS.PANEL}`}>
      {/* Sidebar Header with Timeline Actions */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 select-none">
          <BookOpen className="text-indigo-400" size={18} />
          <span>Derivations</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST}`}
            title="Undo Step"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST}`}
            title="Redo Step"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleResetAll}
            disabled={history.length <= INDEX_INCREMENT}
            className={`p-1.5 rounded-lg border border-white/10 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST}`}
            title="Reset Derivation"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Step History Timeline */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 select-none">
          History Timeline
        </h3>
        <div className="flex flex-col gap-2 relative">
          {/* Vertical connector line */}
          <div className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-indigo-500/20" />

          {history.map((eq: Equation, idx: number) => {
            const isActive = idx === currentIndex;
            const stepNum = idx;

            return (
              <div
                key={idx}
                onClick={() => handleStepClick(idx)}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all duration-200 group/step ${
                  isActive
                    ? 'border-indigo-400/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/5'
                    : 'border-white/5 hover:border-white/10 bg-white/0 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs shrink-0 ${
                      isActive
                        ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20'
                        : 'border-white/10 text-white/45'
                    }`}
                  >
                    {stepNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                      {idx === DEFAULT_ZERO ? 'Initial State' : `Step ${idx}`}
                    </div>
                    <div className="text-sm font-mono truncate text-indigo-100 font-medium">
                      {equationToString(eq)}
                    </div>
                  </div>
                </div>

                {/* Hover copy button */}
                <button
                  onClick={(e) => handleCopyStep(e, eq, idx)}
                  className={`p-1.5 rounded-lg border border-white/5 text-white/40 hover:text-white hover:bg-white/10 hover:border-white/15 opacity-0 group-hover/step:opacity-100 transition-all duration-150 shrink-0 ${
                    copiedIndex === idx ? 'text-emerald-400 hover:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 opacity-100' : ''
                  }`}
                  title="Copy Equation"
                >
                  {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Library */}
      <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 select-none flex items-center gap-1">
          <Hash size={12} className="text-indigo-400" />
          <span>Presets Library</span>
        </h3>
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {MATH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.equation)}
              className="flex items-center justify-between text-left p-2.5 rounded-xl border border-white/5 bg-white/0 hover:bg-white/5 hover:border-white/10 group transition-all duration-200"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-xs text-indigo-300 font-semibold group-hover:text-indigo-200 transition-colors">
                  {preset.label}
                </div>
                <div className="text-sm font-mono text-white/70 group-hover:text-white transition-colors truncate">
                  {preset.equation}
                </div>
              </div>
              <Play
                size={12}
                className="text-white/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 transform transition-all duration-200 shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
